# ml_core.py
import pandas as pd
import numpy as np
import requests
from datetime import timedelta
import openmeteo_requests
import requests_cache
from retry_requests import retry

# --- Open-Meteo client (cached + retries)
_cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
_retry_session = retry(_cache_session, retries=5, backoff_factor=0.2)
_openmeteo = openmeteo_requests.Client(session=_retry_session)

def fetch_train_schedule(train_number: int) -> pd.DataFrame:
    url = f"https://railway-rescheduling-automation-system.onrender.com/api/trains/{train_number}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    df = pd.DataFrame(r.json()["schedule"])
    df["scheduled_arrival"] = pd.to_datetime(df["scheduled_arrival"])
    return df

def fetch_station_data(station_code: str) -> dict:
    url = f"https://railway-rescheduling-automation-system.onrender.com/api/stations/{station_code}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    return r.json()

def _classify_weather(code: int) -> str:
    if code in [0, 1]: return "Clear"
    if code in [2, 3]: return "Clouds"
    if code in [45, 48]: return "Fog"
    if code in [51, 53, 55]: return "Drizzle"
    if code in [61, 63, 65, 80, 81, 82, 95, 96, 99]: return "Rain"
    if code in [56, 57]: return "Mist"
    return "Clear"

def get_weather_15min_for_station(lat: float, lon: float, time) -> dict | None:
    try:
        scheduled_time = pd.to_datetime(time)
        if scheduled_time.tzinfo is None:
            scheduled_time = scheduled_time.tz_localize("Asia/Kolkata")
        else:
            scheduled_time = scheduled_time.tz_convert("Asia/Kolkata")

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat, "longitude": lon,
            "minutely_15": [
                "temperature_2m","apparent_temperature","relative_humidity_2m",
                "pressure_msl","windspeed_10m","winddirection_10m",
                "visibility","cloudcover","dew_point_2m","weathercode"
            ],
            "timezone": "auto"
        }
        responses = _openmeteo.weather_api(url, params=params)
        response = responses[0]
        m15 = response.Minutely15()

        df = pd.DataFrame({
            "time": pd.to_datetime(m15.Time(), unit="s", utc=True),
            "temp": m15.Variables(0).ValuesAsNumpy(),
            "feels_like": m15.Variables(1).ValuesAsNumpy(),
            "humidity": m15.Variables(2).ValuesAsNumpy(),
            "pressure": m15.Variables(3).ValuesAsNumpy(),
            "wind_speed": m15.Variables(4).ValuesAsNumpy(),
            "wind_deg": m15.Variables(5).ValuesAsNumpy(),
            "visibility": m15.Variables(6).ValuesAsNumpy(),
            "clouds": m15.Variables(7).ValuesAsNumpy(),
            "dew_point": m15.Variables(8).ValuesAsNumpy(),
            "weather_code": m15.Variables(9).ValuesAsNumpy(),
        })

        if df["time"].dt.tz is None:
            df["time"] = df["time"].dt.tz_localize("UTC").dt.tz_convert("Asia/Kolkata")
        else:
            df["time"] = df["time"].dt.tz_convert("Asia/Kolkata")

        row = df.iloc[(df["time"] - scheduled_time).abs().argsort()[:1]].copy()
        row["weather_main"] = row["weather_code"].apply(_classify_weather)
        row.drop(columns=["weather_code"], inplace=True)
        row["sea_level"] = row["pressure"]

        return row.iloc[0].to_dict()
    except Exception:
        return None

def get_tracks_trains_nearby(station_data: dict, target_time) -> dict:
    forecasts = station_data.get("forecasts", [])
    if not forecasts:
        return {"tracks_on_route": 1, "trains_nearby": 0}
    df_f = pd.DataFrame(forecasts)
    df_f["timestamp"] = pd.to_datetime(df_f["timestamp"], utc=True).dt.tz_convert("Asia/Kolkata")
    closest = df_f.iloc[(df_f["timestamp"] - target_time).abs().argsort()[:1]]
    return {
        "tracks_on_route": int(closest["tracks_on_route"].values[0]),
        "trains_nearby": int(closest["trains_nearby"].values[0])
    }

def simulate_schedule_variant(shifted_schedule: pd.DataFrame,
                              original_schedule: pd.DataFrame,
                              final_model,
                              le_dict) -> dict:
    start_time_variant = pd.to_datetime(shifted_schedule["scheduled_arrival"].dropna().iloc[0])

    cumulative_delay = 0.0
    weather_records_sim = []

    for i, row in shifted_schedule.iterrows():
        if pd.isna(row["scheduled_arrival"]):
            continue

        # Shifted
        sched_arr = pd.to_datetime(row["scheduled_arrival"])
        if sched_arr.tzinfo is None:
            sched_arr = sched_arr.tz_localize("Asia/Kolkata")
        else:
            sched_arr = sched_arr.tz_convert("Asia/Kolkata")

        # Original
        original_arr = pd.to_datetime(original_schedule.loc[i, "scheduled_arrival"])
        if original_arr.tzinfo is None:
            original_arr = original_arr.tz_localize("Asia/Kolkata")
        else:
            original_arr = original_arr.tz_convert("Asia/Kolkata")

        forecast_time = sched_arr + timedelta(minutes=cumulative_delay)

        # Weather + station context
        station_info = fetch_station_data(row["station_code"])
        weather = get_weather_15min_for_station(row["lat"], row["lon"], forecast_time)
        if weather is None:
            continue
        weather.update(get_tracks_trains_nearby(station_info, forecast_time))

        # Build feature row for model
        import pandas as _pd
        X_row = _pd.DataFrame([{
            'temp': weather['temp'] + 273.15,
            'feels_like': weather['feels_like'] + 273.15,
            'humidity': weather['humidity'],
            'pressure': weather['pressure'],
            'wind_speed': weather['wind_speed'],
            'wind_deg': weather['wind_deg'],
            'visibility': weather['visibility'],
            'clouds': weather['clouds'],
            'dew_point': weather['dew_point'] + 273.15,
            'weather_main': weather['weather_main'],
            'lat': row['lat'],
            'lon': row['lon'],
            'altitude': row['altitude'],
            'sea_level': weather['sea_level'],
            'day_of_week': row['day_of_week'],
            'day_of_journey': row['day_of_journey'],
            'tracks_on_route': weather['tracks_on_route'],
            'trains_nearby': weather['trains_nearby']
        }])

        # Safe label encoding
        for col in X_row.columns:
            if col in le_dict:
                X_row[col] = X_row[col].astype(str).apply(
                    lambda x: le_dict[col].transform([x])[0] if x in le_dict[col].classes_ else -1
                )

        # Align with model
        X_row = X_row.reindex(columns=final_model.feature_names_in_, fill_value=0)

        # Predict & accumulate
        delay_pred = float(final_model.predict(X_row)[0])
        cumulative_delay += delay_pred
        actual_arr = sched_arr + timedelta(minutes=cumulative_delay)

        weather_records_sim.append({
            "station_index": int(i),
            "station_code": row["station_code"],
            "station_name": row["station_name"],
            "original_scheduled_arrival": original_arr,
            "scheduled_arrival_shifted": sched_arr,
            "forecast_time": forecast_time,
            "predicted_delay": delay_pred,
            "cumulative_delay": cumulative_delay,
            "actual_arrival_predicted": actual_arr,
            "start_time_variant": start_time_variant
        })

    sim_df = pd.DataFrame(weather_records_sim)
    total_delay_sim = float(sim_df["cumulative_delay"].iloc[-1]) if not sim_df.empty else None

    return {
        "start_time_variant": start_time_variant,
        "total_delay": total_delay_sim,
        "detail_df": sim_df
    }

def simulate_original_variant(train_number: int, final_model, le_dict) -> dict:
    """Fetch schedule and simulate only the original (unshifted) schedule."""
    sched = fetch_train_schedule(train_number)
    return simulate_schedule_variant(sched, sched, final_model, le_dict)

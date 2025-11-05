import pandas as pd
import numpy as np
import requests
from datetime import timedelta
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
import openmeteo_requests
import requests_cache
from retry_requests import retry
import pickle

# -------------------- CONFIG --------------------
TRAIN_NUMBER = 15938  # Replace with your train number
MODEL_PATH = "final_model.pkl"  
LE_DICT_PATH = "le_dict.pkl"    

# -------------------- INITIAL SETUP --------------------
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

with open(MODEL_PATH, "rb") as f:
    final_model = pickle.load(f)

with open(LE_DICT_PATH, "rb") as f:
    le_dict = pickle.load(f)

# -------------------- HELPER FUNCTIONS --------------------
def fetch_train_schedule(train_number):
    url = f"https://railway-rescheduling-automation-system.onrender.com/api/trains/{train_number}"
    r = requests.get(url)
    r.raise_for_status()
    df = pd.DataFrame(r.json()['schedule'])
    return df

def fetch_station_data(station_code):
    url = f"https://railway-rescheduling-automation-system.onrender.com/api/stations/{station_code}"
    r = requests.get(url)
    r.raise_for_status()
    return r.json()

def get_weather_15min_for_station(lat, lon, time):
    try:
        scheduled_time = pd.to_datetime(time)
        if scheduled_time.tzinfo is None:
            scheduled_time = scheduled_time.tz_localize("Asia/Kolkata")
        else:
            scheduled_time = scheduled_time.tz_convert("Asia/Kolkata")

        print(f"Fetching weather for lat={lat}, lon={lon}, time={scheduled_time}")

        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "minutely_15": [
                "temperature_2m","apparent_temperature","relative_humidity_2m",
                "pressure_msl","windspeed_10m","winddirection_10m",
                "visibility","cloudcover","dew_point_2m","weathercode"
            ],
            "timezone": "auto"
        }

        responses = openmeteo.weather_api(url, params=params)
        response = responses[0]
        minutely_15 = response.Minutely15()
        df = pd.DataFrame({
            "time": pd.to_datetime(minutely_15.Time(), unit="s", utc=True),
            "temp": minutely_15.Variables(0).ValuesAsNumpy(),
            "feels_like": minutely_15.Variables(1).ValuesAsNumpy(),
            "humidity": minutely_15.Variables(2).ValuesAsNumpy(),
            "pressure": minutely_15.Variables(3).ValuesAsNumpy(),
            "wind_speed": minutely_15.Variables(4).ValuesAsNumpy(),
            "wind_deg": minutely_15.Variables(5).ValuesAsNumpy(),
            "visibility": minutely_15.Variables(6).ValuesAsNumpy(),
            "clouds": minutely_15.Variables(7).ValuesAsNumpy(),
            "dew_point": minutely_15.Variables(8).ValuesAsNumpy(),
            "weather_code": minutely_15.Variables(9).ValuesAsNumpy(),
        })

        if df["time"].dt.tz is None:
            df["time"] = df["time"].dt.tz_localize("UTC").dt.tz_convert("Asia/Kolkata")
        else:
            df["time"] = df["time"].dt.tz_convert("Asia/Kolkata")

        row = df.iloc[(df["time"] - scheduled_time).abs().argsort()[:1]].copy()

        def classify_weather(code):
            if code in [0, 1]: return "Clear"
            elif code in [2, 3]: return "Clouds"
            elif code in [45, 48]: return "Fog"
            elif code in [51, 53, 55]: return "Drizzle"
            elif code in [61, 63, 65, 80, 81, 82, 95, 96, 99]: return "Rain"
            elif code in [56, 57]: return "Mist"
            else: return "Clear"

        row["weather_main"] = row["weather_code"].apply(classify_weather)
        row.drop(columns=["weather_code"], inplace=True)
        row["sea_level"] = row["pressure"]

        return row.iloc[0].to_dict()

    except Exception as e:
        print(f"Weather fetch failed for {lat},{lon}: {e}")
        return None

def get_tracks_trains_nearby(station_data, target_time):
    forecasts = station_data.get("forecasts", [])
    if not forecasts:
        return {"tracks_on_route": 1, "trains_nearby": 0}
    df_f = pd.DataFrame(forecasts)
    df_f['timestamp'] = pd.to_datetime(df_f['timestamp'], utc=True).dt.tz_convert('Asia/Kolkata')
    closest = df_f.iloc[(df_f["timestamp"] - target_time).abs().argsort()[:1]]
    return {
        "tracks_on_route": int(closest["tracks_on_route"].values[0]),
        "trains_nearby": int(closest["trains_nearby"].values[0])
    }

# -------------------- LOAD TRAIN SCHEDULE --------------------
train_schedule = fetch_train_schedule(TRAIN_NUMBER)
train_schedule["scheduled_arrival"] = pd.to_datetime(train_schedule["scheduled_arrival"])

# -------------------- SIMULATION FUNCTION --------------------
def simulate_schedule_variant(shifted_schedule, original_schedule):
    """
    Simulate one schedule variant (shifted start time) with cumulative delay and weather fetch.
    """
    start_time_variant = pd.to_datetime(
        shifted_schedule["scheduled_arrival"].dropna().iloc[0]
    )
    
    print("\n" + "=" * 60)
    print(f"Simulating Schedule Variant starting at: {start_time_variant}")
    print("=" * 60)

    cumulative_delay = 0
    weather_records_sim = []

    for i, row in shifted_schedule.iterrows():
        if pd.isna(row["scheduled_arrival"]):
            continue

        # Shifted scheduled arrival
        sched_arr = pd.to_datetime(row["scheduled_arrival"])
        if sched_arr.tzinfo is None:
            sched_arr = sched_arr.tz_localize("Asia/Kolkata")
        else:
            sched_arr = sched_arr.tz_convert("Asia/Kolkata")

        # Original scheduled arrival
        original_arr = pd.to_datetime(original_schedule.loc[i, "scheduled_arrival"])
        if original_arr.tzinfo is None:
            original_arr = original_arr.tz_localize("Asia/Kolkata")
        else:
            original_arr = original_arr.tz_convert("Asia/Kolkata")

        # Forecast time adjusted for cumulative delay
        forecast_time = sched_arr + timedelta(minutes=cumulative_delay)

        # Fetch station info & weather
        station_info = fetch_station_data(row["station_code"])
        weather = get_weather_15min_for_station(row["lat"], row["lon"], forecast_time)
        if weather is None:
            print(f"No weather data for station {row['station_code']} at {forecast_time}")
            continue

        # Get tracks/trains nearby
        tracks_trains = get_tracks_trains_nearby(station_info, forecast_time)
        weather.update(tracks_trains)

        # Prepare model input
        X_row = pd.DataFrame([{
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

        # Encode categorical columns
        for col in X_row.columns:
            if col in le_dict:
                X_row[col] = X_row[col].astype(str).apply(
                    lambda x: le_dict[col].transform([x])[0] if x in le_dict[col].classes_ else -1
                )

        # Align columns and predict
        X_row = X_row.reindex(columns=final_model.feature_names_in_, fill_value=0)
        delay_pred = float(final_model.predict(X_row)[0])
        cumulative_delay += delay_pred
        actual_arr = sched_arr + timedelta(minutes=cumulative_delay)

        # Record step
        weather_records_sim.append({
            "station_index": i,
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

        print(f"Station {row['station_code']}: Original = {original_arr.strftime('%H:%M')}, "
              f"Shifted = {sched_arr.strftime('%H:%M')}, "
              f"Predicted Delay = {delay_pred:.2f} min | Cumulative = {cumulative_delay:.2f} min | ETA = {actual_arr.strftime('%H:%M')}")

    # Convert to DataFrame
    sim_df = pd.DataFrame(weather_records_sim)
    total_delay_sim = sim_df["cumulative_delay"].iloc[-1] if not sim_df.empty else None

    print(f"\nTotal Cumulative Delay for Variant ({start_time_variant}) = {total_delay_sim:.2f} minutes\n")

    return {
        "start_time_variant": start_time_variant,
        "total_delay": total_delay_sim,
        "detail_df": sim_df
    }

# -------------------- RUN SIMULATION FOR ALL START TIMES --------------------
interval = timedelta(minutes=15)
total_shift_duration = timedelta(hours=4)
base_start_time = train_schedule["scheduled_arrival"].dropna().iloc[0]
num_intervals = int(total_shift_duration.total_seconds() // interval.total_seconds())
shift_times = [base_start_time + i * interval for i in range(num_intervals + 1)]

sim_results = []
for start_time in shift_times:
    # Shift the entire schedule by the difference from base start time
    shift_minutes = (start_time - base_start_time).total_seconds() / 60
    shifted_schedule = train_schedule.copy()
    shifted_schedule["scheduled_arrival"] = shifted_schedule["scheduled_arrival"] + timedelta(minutes=shift_minutes)

    # Simulate this variant
    result = simulate_schedule_variant(shifted_schedule, train_schedule)  # <-- pass original schedule
    sim_results.append(result)

# Summary
summary_df = pd.DataFrame([{"start_time_variant": r["start_time_variant"], "total_delay": r["total_delay"]} 
                           for r in sim_results if r["total_delay"] is not None]).sort_values("total_delay")

print("\n=== Summary of total delays for alternative schedules ===")
print(summary_df)

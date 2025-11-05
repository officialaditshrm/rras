import pandas as pd
import numpy as np
import warnings
import pickle
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")
pd.set_option('display.max_columns', None)

# =========================
# Load and clean dataset
# =========================
df = pd.read_csv("synthetic_dataset.csv")

# Fill missing humidity & altitude
df['humidity'] = df['humidity'].fillna(round(df['humidity'].mean()))
df['altitude'] = df['altitude'].fillna(round(df['altitude'].mean(), 2))

# Drop unnecessary columns
df = df.drop(['train_number', 'train_name', 'origin_name', 'dest_name', 'weather_desc'], axis=1, errors='ignore')

# Remove negative dwell minutes if present
if 'dwell_minutes' in df.columns:
    df = df[df['dwell_minutes'] >= 0]

# Convert time columns to datetime
time_cols = ["scheduled_arr_time", "scheduled_dept_time", "actual_arr_time", "actual_dept_time"]
for col in time_cols:
    if col in df.columns:
        df[col] = pd.to_datetime(df[col], errors='coerce')

# Calculate overall_delay_minutes
if all(x in df.columns for x in ['actual_arr_time','scheduled_arr_time','actual_dept_time','scheduled_dept_time','origin_code','curr_station_code']):
    df["overall_delay_minutes"] = np.where(
        df["origin_code"] == df["curr_station_code"],
        (df["actual_dept_time"] - df["scheduled_dept_time"]).dt.total_seconds() / 60,
        df[["actual_arr_time", "scheduled_arr_time", "actual_dept_time", "scheduled_dept_time"]].apply(
            lambda x: max(
                (x["actual_arr_time"] - x["scheduled_arr_time"]).total_seconds() / 60,
                (x["actual_dept_time"] - x["scheduled_dept_time"]).total_seconds() / 60
            ),
            axis=1
        )
    )
    df["overall_delay_minutes"] = df["overall_delay_minutes"].clip(lower=0)
else:
    df["overall_delay_minutes"] = df.get("dwell_minutes", pd.Series(np.zeros(len(df))))

# Drop unused columns
drop_cols = ['temp_min','temp_max','origin_code','dest_code','scheduled_arr_time','actual_arr_time','scheduled_dept_time','actual_dept_time','dwell_minutes','curr_station_code']
df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors='ignore')

# Encode categorical columns
cat_cols = [c for c in df.select_dtypes(include='object').columns if c not in ['overall_delay_minutes']]
le_dict = {}
for col in cat_cols:
    le = LabelEncoder()
    df[col] = df[col].fillna("NA")
    df[col] = le.fit_transform(df[col])
    le_dict[col] = le

# Features and target
X = df.drop(columns=["overall_delay_minutes"])
y = df["overall_delay_minutes"]

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# =========================
# Define and train models
# =========================
def evaluate(model, X_t, y_t, name):
    preds = model.predict(X_t)
    return {
        "Model": name,
        "MAE": mean_absolute_error(y_t, preds),
        "RMSE": np.sqrt(mean_squared_error(y_t, preds)),
        "R2": r2_score(y_t, preds)
    }

results = []

# Linear models
linear_models = {
    "Linear Regression": LinearRegression(),
    "Ridge": Ridge(),
    "Lasso": Lasso()
}

linear_params = {
    "Ridge": {"model__alpha": [0.1, 1.0, 10.0]},
    "Lasso": {"model__alpha": [0.0001, 0.001, 0.01, 0.1]},
}

for name, model in linear_models.items():
    pipe = Pipeline([("scaler", StandardScaler()), ("model", model)])
    if name in linear_params:
        grid = GridSearchCV(pipe, linear_params[name], cv=5, scoring="neg_mean_absolute_error")
        grid.fit(X_train, y_train)
        best_model = grid.best_estimator_
        print(f"Best Params for {name}: {grid.best_params_}")
    else:
        best_model = pipe.fit(X_train, y_train)
    cv_score = cross_val_score(best_model, X_train, y_train, cv=5, scoring="r2").mean()
    res = evaluate(best_model, X_test, y_test, name)
    res["CV_R2"] = cv_score
    results.append(res)

# Tree-based models
tree_models = {
    "Random Forest": RandomForestRegressor(random_state=42),
    "Gradient Boosting": GradientBoostingRegressor(random_state=42),
    "XGBoost": XGBRegressor(random_state=42, verbosity=0)
}

tree_params = {
    "Random Forest": {"n_estimators": [100, 200], "max_depth": [5, 10, None]},
    "Gradient Boosting": {"n_estimators": [100, 200], "learning_rate": [0.05, 0.1]},
    "XGBoost": {"n_estimators": [100, 300], "learning_rate": [0.05, 0.1], "max_depth": [3, 5, 7]}
}

for name, model in tree_models.items():
    grid = GridSearchCV(model, tree_params[name], cv=5, scoring="neg_mean_absolute_error", n_jobs=-1)
    grid.fit(X_train, y_train)
    best_model = grid.best_estimator_
    cv_score = cross_val_score(best_model, X_train, y_train, cv=5, scoring="r2").mean()
    res = evaluate(best_model, X_test, y_test, name)
    res["CV_R2"] = cv_score
    results.append(res)
    print(f"{name} trained. RMSE={res['RMSE']:.2f}, R2={res['R2']:.2f}, CV_R2={cv_score:.2f}")

# =========================
# Select best model
# =========================
results_df = pd.DataFrame(results)
results_df["score"] = results_df["CV_R2"] - (results_df["RMSE"] / results_df["RMSE"].max())
best_model_name = results_df.loc[results_df["score"].idxmax(), "Model"]
print("\nBest Model Selected:", best_model_name)

# Retrain best model on full dataset
if best_model_name == "Linear Regression":
    final_model = Pipeline([("scaler", StandardScaler()), ("model", LinearRegression())]).fit(X, y)
elif best_model_name == "Ridge":
    final_model = Pipeline([("scaler", StandardScaler()), ("model", Ridge(alpha=1.0))]).fit(X, y)
elif best_model_name == "Lasso":
    final_model = Pipeline([("scaler", StandardScaler()), ("model", Lasso(alpha=0.01))]).fit(X, y)
elif best_model_name == "Random Forest":
    final_model = RandomForestRegressor(n_estimators=200, max_depth=None, random_state=42).fit(X, y)
elif best_model_name == "Gradient Boosting":
    final_model = GradientBoostingRegressor(n_estimators=200, learning_rate=0.1, random_state=42).fit(X, y)
elif best_model_name == "XGBoost":
    final_model = XGBRegressor(n_estimators=300, learning_rate=0.1, max_depth=5, random_state=42, verbosity=0).fit(X, y)
else:
    raise ValueError(f"Unknown model: {best_model_name}")

# =========================
# Save the model and label encoders
# =========================
with open("final_model.pkl", "wb") as f:
    pickle.dump(final_model, f)

with open("le_dict.pkl", "wb") as f:
    pickle.dump(le_dict, f)

print("Model training complete. Saved as 'final_model.pkl' and 'le_dict.pkl'.")

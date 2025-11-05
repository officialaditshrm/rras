# ml_api.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import pickle
import os

from ml_core import simulate_original_variant

# ---- config / model paths
MODEL_PATH = os.environ.get("MODEL_PATH", "final_model.pkl")
LE_DICT_PATH = os.environ.get("LE_DICT_PATH", "le_dict.pkl")

# ---- load once
with open(MODEL_PATH, "rb") as f:
    FINAL_MODEL = pickle.load(f)
with open(LE_DICT_PATH, "rb") as f:
    LE_DICT = pickle.load(f)

app = Flask(__name__)
# If browser calls Flask directly; harmless if proxied by Node:
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})


@app.route("/api/ml/simulate", methods=["POST"])
@app.route("/api/ml/simulate", methods=["POST"])
def simulate():
    data = request.get_json(silent=True) or {}
    train_number = data.get("train_number")
    if not train_number:
        return jsonify({"error": "train_number is required"}), 400

    try:
        result = simulate_all_variants(int(train_number), FINAL_MODEL, LE_DICT)

        # serialize best variant detail_df
        df = result["best_detail"].copy() if result["best_detail"] is not None else pd.DataFrame()
        for col in ["original_scheduled_arrival","scheduled_arrival_shifted",
                    "forecast_time","actual_arrival_predicted","start_time_variant"]:
            if col in df.columns:
                df[col] = df[col].apply(lambda x: x.isoformat() if pd.notna(x) else None)

        payload = {
            "train_number": result["train_number"],
            "best_variant": result["best_variant"],
            "all_variants": result["all_variants"],
            "detail_df": df.to_dict(orient="records")
        }
        return jsonify(payload)
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Run this service alongside your Node API
    app.run(host="0.0.0.0", port=7001, debug=True)

import numpy as np

class BenchmarkEngine:

    def __init__(self, peer_values):
        if len(peer_values) < 5:
            raise ValueError("Minimum 5 peer values required")

        self.peer_values = np.array(peer_values)
        self.stats = self._compute_stats()

    def _compute_stats(self):
        return {
            "p25": np.percentile(self.peer_values, 25),
            "median": np.percentile(self.peer_values, 50),
            "p75": np.percentile(self.peer_values, 75),
            "p90": np.percentile(self.peer_values, 90),
            "mean": np.mean(self.peer_values)
        }

    def ideal_range(self):
        return (self.stats["p25"], self.stats["p75"])

    def classify(self, client_value):
        if client_value > self.stats["p90"]:
            return "Significantly Above Industry Norm"
        elif client_value > self.stats["p75"]:
            return "Above Normal"
        elif client_value >= self.stats["p25"]:
            return "Within Normal Range"
        else:
            return "Below Normal"

    def analyze(self, client_value):
        classification = self.classify(client_value)
        ideal_low, ideal_high = self.ideal_range()

        return {
            "client_value": round(client_value, 4),
            "industry_median": round(self.stats["median"], 4),
            "ideal_range": (
                round(ideal_low, 4),
                round(ideal_high, 4)
            ),
            "p90_threshold": round(self.stats["p90"], 4),
            "classification": classification
        }
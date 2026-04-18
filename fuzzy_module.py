import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt

def calculate_levenshtein(s1, s2):
    """Calculates the Levenshtein distance between two strings."""
    if len(s1) < len(s2): return calculate_levenshtein(s2, s1)
    if not s2: return len(s1)
    prev = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(curr[j]+1, prev[j+1]+1, prev[j]+(c1!=c2)))
        prev = curr
    return prev[-1]

def get_similarity_matrix(names_list):
    """Generates a similarity matrix (0 to 1) for a list of strings."""
    n = len(names_list)
    matrix = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            dist = calculate_levenshtein(names_list[i], names_list[j])
            max_l = max(len(names_list[i]), len(names_list[j]))
            matrix[i, j] = 1 - (dist / max_l) if max_l > 0 else 1
    return matrix

def plot_fuzzy_heatmap(matrix, labels, save_path='fuzzy_matrix.png'):
    """Visualizes the similarity matrix as a heatmap."""
    plt.figure(figsize=(10, 8))
    sns.heatmap(matrix, annot=True, fmt=".2f", cmap='YlOrRd', 
                xticklabels=labels, yticklabels=labels)
    plt.title('Fuzzy Entity Reconciliation: Vendor Similarity')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
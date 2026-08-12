// The entry file of your WebAssembly module.

// A fast Levenshtein distance implementation in AssemblyScript
export function levenshteinDistance(a: string, b: string): i32 {
  if (a.length == 0) return b.length;
  if (b.length == 0) return a.length;

  let matrix = new Int32Array((a.length + 1) * (b.length + 1));

  for (let i = 0; i <= a.length; i++) {
    matrix[i * (b.length + 1) + 0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0 * (b.length + 1) + j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      let cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
      
      let deletion = matrix[(i - 1) * (b.length + 1) + j] + 1;
      let insertion = matrix[i * (b.length + 1) + (j - 1)] + 1;
      let substitution = matrix[(i - 1) * (b.length + 1) + (j - 1)] + cost;

      // min of three
      let minVal = deletion < insertion ? deletion : insertion;
      minVal = minVal < substitution ? minVal : substitution;
      
      matrix[i * (b.length + 1) + j] = minVal;
    }
  }

  return matrix[a.length * (b.length + 1) + b.length];
}

// Normalized fuzzy match score (0.0 to 100.0)
export function fuzzyMatchScore(a: string, b: string): f32 {
  if (a.length == 0 && b.length == 0) return 100.0;
  if (a.length == 0 || b.length == 0) return 0.0;
  
  let distance = levenshteinDistance(a, b);
  let maxLength = Math.max(a.length, b.length) as f32;
  
  let score = ((maxLength - (distance as f32)) / maxLength) * 100.0;
  return score;
}

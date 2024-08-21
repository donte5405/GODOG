//@ts-check
/**
 * Shuffle an array.
 * @param {Array} arr 
 */
export function shuffleArray(arr) {
	fastShuffle(arr);
}


/**
 * Fast array shuffle function (ChatGPT gave me this).
 * @param {Array} arr 
 */
function fastShuffle(arr) {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]]; // Swap elements using destructuring assignment.
	}
}

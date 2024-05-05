//@ts-check
/**
 * Shuffle an array.
 * @param {Array} arr 
 */
export function shuffleArray(arr) {
    fastShuffle(arr);
}


/**
 * Old implementation of array shuffle.
 * @param {Array} arr 
 */
function slowShuffle(arr) {
    const temp = [];
    while (arr.length > 0) {
        temp.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    }
    while (temp.length > 0) {
        arr.push(temp.splice(0,1)[0]);
    }
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

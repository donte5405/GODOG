//@ts-check
/**
 * Shuffle an array.
 * @param {Array} arr 
 */
export function shuffleArray(arr) {
    const temp = [];
    while (arr.length > 0) {
        temp.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
    }
    while (temp.length > 0) {
        arr.push(temp.splice(0,1)[0]);
    }
}

//@ts-check
import { loadGodotLabels } from "./lib/godot.labels.mjs";


const sourcePath = process.argv[2];


if (!sourcePath) {
    throw new Error("Please specify Godot source path.");
}


loadGodotLabels(sourcePath);

//@ts-check
import { loadGodotLabels } from "./lib/godot.labels.mjs";


const errNoProjSource = new Error("Please specify Godot source path.");


const sourcePath = process.argv[2];


if (!sourcePath) {
	throw errNoProjSource;
}


loadGodotLabels(sourcePath);

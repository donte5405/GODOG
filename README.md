#  GODOG
Because not all Godot projects should be (physically) open source! That's just unacceptable!

![Godot Engine Logo Copyright (c) 2017 Andrea Calabró. Altered to resemble dog's look. This work is licensed under the Creative Commons Attribution 4.0 International](https://github.com/donte5405/Godog/assets/134863321/9aeabe59-f11f-4e11-898d-a13ea7c0142c)

---

## Still Not Ready For Production!
If you aren't afraid of it ruining your work, use it however you please, but **don't ever say that I didn't warn you**.

---

### What This Project Does?
It tries to strip away every single user-defined labels as much as it's realistically possible while still maintaining project's functionality the best it can.

---

### Is This DRM or Copy Protection?
No, nor it's even remotely close. This only strips away anything that Godot doesn't need in order for it to run, making it more difficult to restore the project back into its original source code.

---

### Then What's The Point?
Online games being made with Godot without any of custom toolchains to scramble its source code will be vulnerable by default. In commercial scenarios it's absolutely undesirable to have the source code always readable and especially easily alterable, even with the scenario where you have the game operated mostly server-side. Even if the game is just for the display, if the server logic is easily replicable, there's nothing that stops bad actors to develop custom clients to gain advantages in your game and skip your "legitimate" client completely, or even using your "client shell" for their own games being operated underground. This project adds extra tasks to those bad actors trying to take advantage on your Godot project.

---

### Prerequisites
Make sure that you have Node.JS 21.6.2 or later.

Clone this project, and clone/download Godot's source code from the Godot repository. Don't forget to check/switch branch if the version you use matches with the version that you're using to develop the game.

Then, run this command:

```sh
./godot.labels.gen.sh /path/to/the/godot/source/code/directory
```

It will start generating possible Godot labels the best effort it can, this need to be run only once. You can also delete the Godot source code after this action.

---

### Using GODOG
To start converting the project into a scrambled one, run the command below:

```sh
./godog.sh /path/to/your/project /path/to/target/folder
```

This will generate a new Godot project from `/path/to/your/project` into `/path/to/target/folder`. Also, there will be two files generated into `/path/to/your/project`.
- `dbg.sym.json`, a file contains all debug symbols generated.
- `godog.json`, a configuration file.

---

### GODOG Configuration
There are few configurations that GODOG offer to fine-tune its behaviour. The configuration file be stored in the project on the first run, or simply create a file named `godog.json` in the project's root directory.

Then write the file in JSON fashion as usual.

```js
{
    "scrambleGodotFiles": true, // This tells if GODOG will completely scramble TSCN, TRES, and GDScript file locations.
    "ignoreStringFormattings": false // This tells if GODOG will ignore direct string formattings.
}
```

- `scrambleGodotFiles`: `boolean`
Tells GODOG to move all Godot documents (`.gd`, `.tscn`, `.tres`) into the project's root directory.
- `ignoreStringFormattings`: `boolean`
Tells if GODOG will ignore direct string formattings. **This should always have been disabled unless you absolutely know what you're doing.**

---

### Additional Macros
GODOG also supports some in-line preprocessors. It detects GDScript comments and try to parse it if the condition meets.

#### 1. Label Mangler
This GDScript macro will generate random string index using `#GODOG_LABEL:` to generate the scrambled string as follows:

```gdscript
#GODOG_LABEL:player_hp
#GODOG_LABEL:player_mp,player_def 

# Yes, it also supports multiple labels in single line separated with commas.
```

In order to use it, just referring it with strings as usual:

```gdscript
json["player_hp"]
```

GODOG will automatically convert it into something nonsense in the final result, for example:

```gdscript
json["_ab"]
```

#### 2. Private Field Mangler
This GDScript macro indentifies any labels that the user want it to be private fields, this help complicating source restoration even more, but also introduces a phenomenon where it causes errors if the field is accessed outside of a script file.

```gdscript
#GODOG_PRIVATE:_velocity
```

---

### CAUTION (MUST READ)

Since this project involves a complete string manipulation, it may introduce undesirable side effects from such procedure, and this could cause both representation problems (the game displays scrambled text), or **rendering API communications and data read/write** on storage **completely broken**, **or rendering the game unplayable**.

First and foremost, Unless it's absolutely intentional for reasons (see below), **DO NOT name strings with anything but Roman characters and underscore (`_`)**, since GODOG can't detect it efficiently, especially in Godot resource (`.tscn`/`.tres`) files.

```gdscript
"this_is_my_string" # correct
"this-is-my-string" # WRONG, GODOG CAN'T DETECT KEBAB CASE LABELS!
```

On the text display issue, simply workaround it by adding extra characters into strings in order to prevent it from being manipulated, for example, empty space (space bar). **Using Godot translation functionality also helps avoiding this issue.**

```js
"sometext" -> " sometext " // space added on both ends.
"Okay" -> " Okay " // space added on both ends.
```

Loading and saving has always been a hurdle for game developers especially on how to manage it properly. This project made it even worse because if takes away every single user labels and replacing them with nonsense labels. This creates yet another hurdle for game saving.

Automated binary serialisation is completely broken if using this project. While it's not apparent on the first but the side effect will be apparent on the next export revisions because string entries get swapped. This is not an issue in the past with games that run in machine code because most of them involve manual binary serialisation.

**If your game uses binary serialisation for game saving, DON'T USE GODOG OR IT'LL CORRUPT YOUR SAVE FILES EVERY TIME YOUR GAME UPDATES.** If possible, don't even use this way of game saving because it introduces buffer overflow attack to the machine.

JSON serialisation generally works with GODOG, unless you write JSON in GDScript like this:

```gdscript
{
    player_info = {
        player_name = "Player",
        experience = 0,
        inventory = {
            # blah, blah blah.
        }
    }
}

# Accessing Fields
json.player_info.name
```

As you may already noticed, this exposes user-defined strings directly into GDScript source code, and GODOG will note them as user-defined labels and WILL SCRAMBLE THEM. This means that the game's save will only remain compatible for only one version of your game, and render API calls completely impossible since string names are altered. Fortunately, there are ways to workaround this issue. By converting the syntax to JSON-like will workaround this issue. Adding special characters to the string names will also help. Considering the snippet above, converting it gives this result instead:

```gdscript
var json := {
    "@player_info": { # using '.' to avoind the string getting mangled.
        "@player_name": "Player",
        "@experience": 0,
        "@inventory": {
            # blah, blah blah.
        }
    }
}

# Accessing Fields
json["@player_info"]["@player_name"]
```

Noting that this way, your game's code will become easier to read when getting decompiled in the end, but nothing could be done in this case (except if you utilise translations tables, see below). If this must be used on a server API, it also must be smart enough to filter the extra characters added into the serialised JSON, as it will be explained below.

---

### Working With Game Server APIs
Since GODOG aims at scrambling strings in Godot projects. This makes some of implementations such as API calls completely butchered. The mitigation is already explained as above. But GODOG also exports a complete JSON of "debug symbols" that can be used for remappings. It also offers bi-directional translation, which means this can be used to translate strings in both ways. To utilise it on API game servers, simply using it to convert mangled keys into readable keys. Here's an example of JavaScript-based implementations:

```js
/**
 * Translate object into interpretable state.
 * @param {Record<string,string>} dict 
 * @param {any} obj 
 */
function translate(dict, obj) {
    if (Array.isArray(obj)) {
        for (const i in obj) {
            obj[i] = translate(dict, obj[i]); // Nested translation.
        }
    } else if (typeof obj === "object") {
        for (const key of Object.keys(obj)) {
            const translated = dict[key];
            if (!translated) continue; // If key isn't translated, ignore.
            obj[translated] = translate(dict, obj[key]);
            delete obj[key]; // Delete old mapped key
        }
        return obj;
    } else if (typeof obj === "string") {
        const translated = dict[obj];
        if (translated) return translated;
    }
    return obj;
}
```

This snippet also works to mitigate direct API calls with readable strings (in case if the bad actors somehow know the unmangled names) since the readable strings will be translated into mangled strings, rendering the attempt to access the API with readable names useless.

---

### TIP: Using Translation Table To Store Texts
It may sound absurd, but translation mechanism involves determining which strings that will be used or uses some sort of hash tables. This way helps the source to dissociate relations between scripts and readable descriptions, making it more difficult to search for specific implementations. Godot's built-in `TranslationServer` works really well in this regard. In the translation CSV, putting string keys in quadruple underscores to indicate GODOG that keys must be mangled.

```csv
"key","en"
"GREETING","Hello world!"
```

After GODOG manages to mangle CSV files, Godot also automatically converts  the mangled CSV table into loadable binary and leave the CSV files in PCK exports.

However, the disadvantage of this approach is that Godot's `TranslationServer` is in-memory. If the project has a lot of paragraph worthy of strings (depending on the project's size), it could instead be very undesirable to have them in the memory (especially on HTML5 platform). GODOG also offers a translator that helps on stream-based translations.

To integrate disk-based translations. GODOG offers a syntax that helps in this regard. This can be done in any TSCN/TRES files by putting translation keys in `_*_*_*_` brackets:

```
_*_*_*_
"en": "Hello!",
"es": "¡Hola!",
"de": "Hallo!",
"fr": "Bonjour!",
"cn": "你好!",
"ja": "こんにちは！",
"th": "สวัสดี!"
_*_*_*_
```

The way it stores data is pretty similar to JSON, just replace `{` and `}` with `_*_*_*_` instead. In the debugging environment, the translation will automatically convert this sequence into translation maps, and automatically pick the one that matches user's locale. This process is kinda slow if you have many of supported languages, but it shouldn't be an issue in debug environment. In the export environment, GODOG pre-compiles all lists of strings in project files into pre-computed hash maps stored in a PCK file. The translation function will instead load the string according to user's locale immediately without any additional conversions.

To translate strings using this functionality, use `Tr.dsk()` function from `translator.gd` (stored in `gd` directory of this repo):

```gdscript
Tr.dsk(resource_object.text_hello)
```

Unlike Godot's translation function, this translation function works differently since it involves no unique key. Which means the style of `Tr.dsk("greeting")` will not work with this function. It's on this design since it's intended to handle large strings in resource files.

---

### TIP: Using "Wrong" GDScript Name Styles
Because following style guides in GDScript increases risks of user labels hitting Godot internal labels, making this tool less effective. To help on this, using "these" style guides will help GODOG identifying user labels a lot easier.

- `PascalCase` for publicily accessible labels and function names.
- `_PascalCase` (with an underscore in front of it) for privately accessible labels. 
- `_camelCase` (with an underscore in front of it) for local labels.

Here's an example of how this will work:
```gdscript
extends Node

#GODOG_PRIVATE: _Target, _nodeToWait, _prevModulate, _stt, _prevPos, _prevScale
#GODOG_PRIVATE: Start

export var TargetPath := NodePath("..")
export var Duration := 1.0
export var Delay := 0.0
export var Reverse := false
export var WaitFor: NodePath
export var WaitForSignal := "SignalName"
export(String, "_None", "_Slide", "_Scale") var AdditionalEffects := "_None"
export(String, "_Bottom", "_Left", "_Right", "_Top") var SlideFrom := "_Bottom"

onready var _Target := get_node(TargetPath) as Control

func _ready() -> void:
	var _nodeToWait := get_node_or_null(WaitFor)
	if is_instance_valid(_nodeToWait):
		yield(_nodeToWait, WaitForSignal)
	Start()

func Start() -> void:
	if Duration <= 0:
		return
	var _prevModulate := Color.transparent if Reverse else _Target.modulate
	_Target.modulate = _Target.modulate if Reverse else Color.transparent
	_Target.visible = Reverse
	if Delay:
		yield(get_tree().create_timer(Delay), "timeout")
	_Target.visible = true
	yield(get_tree(), "idle_frame")
	var _stt := get_tree().create_tween()
	_stt.tween_property(_Target, "modulate", _prevModulate, Duration)
	match AdditionalEffects:
		"_Slide":
			var _posStart := Vector2()
			match SlideFrom:
				"_Left":
					_posStart = _Target.rect_position + Vector2.LEFT * 1000
				"_Right":
					_posStart = _Target.rect_position + Vector2.RIGHT * 1000
				"_Top":
					_posStart = _Target.rect_position + Vector2.UP * 1000
				"_Bottom":
					_posStart = _Target.rect_position + Vector2.DOWN * 1000
			var _prevPos := _posStart if Reverse else _Target.rect_position
			_Target.rect_position = _Target.rect_position if Reverse else _posStart
			_stt.parallel().tween_property(_Target, "rect_position", _prevPos, Duration).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		"_Scale":
			var _prevScale := Vector2.ZERO if Reverse else _Target.rect_scale
			_Target.rect_scale = _Target.rect_scale if Reverse else Vector2.ZERO
			_stt.parallel().tween_property(_Target, "rect_scale", _prevScale, Duration).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	if Reverse:
		_stt.connect("finished", _Target, "hide")

```

---

### TIP: Using Translation Files To Store File Paths
In case if in-game resoruces are content-rich and dynimically loaded (common in GaaS), you can also take one more step forward to hide resource paths (like images, text descriptions, and scripts), making it more difficult to trace back resources and where it gets mapped into. Due to its side effect that's primarily used for optimisation, when the CSV paths get converted into `.translation`, the translation keys will get converted into some form of optimised binary and lose the key context it has, along with a cherry on the top by it being a binary format, completely invalidate common string lookup software (notably the `Find in files` functionality in text editor software). Things left is to not forget to use the `tr()` function every time you want to use those strings properly.

You only need one key with the main supported language as its key.

Here's a CSV example of how this will work:
```js
"keys","en"
"UrlDebug","http://localhost:8060"
"UrlProduction","https://sea.men:9042"
"PathDefaultCharacterIcon","res://icon.png"
```

To use it:
```gdscript
var _apiUrl = tr("UrlDebug") if OS.is_debug_build() else tr("UrlProduction")
var _res = http.request(_apiUrl, [], true, HTTPClient.METHOD_POST, RequestBodyStream)
_trCharacterIcon.texture = load(tr("PathDefaultCharacterIcon"))
```

---

### Limitations
- Only works with Godot 3.x at the moment.
- GDScript is the only supported scripting langauge.
- Built-in scripts are NOT supported (may implement it later).
- Options to ignore some crucial strings are not implemented yet.
- **Resource mapping with string formatting will not work!**
	(Example: `"res://scn/scn_game_%d.tscn" % index`, `"Path/To/My/Node%d" % index`)
- **It loves destroying GUI strings. To avoid the issue, store readable strings in translation files instead.**

---

### Future Improvements
Since this implementation already works well enough for me, I'll only improve stability and increment API versions of Node.JS & libraries. However, feel free to open up issues or pull requests in case if you want to improve this project (such as Godot 4 support).

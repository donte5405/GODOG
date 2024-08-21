#  GODOG
Godot 3.x project minifier/obfuscator. Because not all Godot projects should be (physically) open source! That's just unacceptable!

![Godot Engine Logo Copyright (c) 2017 Andrea Calabró. Altered to resemble dog's look. This work is licensed under the Creative Commons Attribution 4.0 International](https://github.com/donte5405/Godog/assets/134863321/9aeabe59-f11f-4e11-898d-a13ea7c0142c)

---

### Final result
Transforms your Godot 3.x project from this,

![image](https://github.com/donte5405/Godog/assets/134863321/a3821eb2-a237-432a-a62a-c57dd53e090d)

...to this!

![image](https://github.com/donte5405/Godog/assets/134863321/6fce4ca0-e203-49fe-b4f3-9a181d80b161)

---

### Tested, But Still Not Ready For Production!
It's been extensively tested with 3.x projects I got hands on. More and more bugs are covered and it's still going. So far, compatible projects work flawlessly with butchered UI strings that could be fixed later with techniques described below. But I'll still not flag the project as "production-ready" yet.

If you aren't afraid of it ruining your work, use it however you please, but **don't ever say that I didn't warn you**.

---

### What This Project Does?
In short, it tries to strip away every single user-defined labels as much as it's realistically possible while still maintaining project's functionality the best it can.

**List of GODOG features.**
- Minify all user labels to compact form (1 – 3 bytes long for small medium sized projects) while *automatically* avoid all Godot's reserved words and API references, reduces up to 30% of Godot resource file size.
- Unify user's source tree, in other words, move all Godot related files to project root directory, helps reducing Godot resource file size even more yet making it a lot more difficult to trace resources and understand the entire project.
- Automatic code analysis and warn if the project is compatible with GODOG or not.
- Provide simple script preprocessors that help stripping unnecessary code blocks that aren't required in a production build, and/or separating builds between client & server builds.
- Provide simple ways to exclude resources between debug source and production builds and/or client-server builds.
- Provide a way to intentionally break version compatibility if mod maintainability is a priority, forcing modders to only stay in a sandbox.
- Provide a method to strip away unnecessary code to ensure compact-ness without affecting functionality, such as additional export parameters.

---

### Is This DRM or Copy Protection?
No, nor it's even remotely close. This only strips away anything that Godot doesn't need in order for it to run, making it more compact yet more difficult to restore Godot project back into its original source code.

---

### Does It Really Obfuscate Code?
If source minification doesn't count as obfuscation, no.

---

### Then What's The Point?
Online games being made with Godot without any of custom toolchains to scramble its source code will be vulnerable by default. In commercial scenarios it's absolutely undesirable to have the source code always readable and especially easily alterable, even with the scenario where you have the game being operated mostly server-side. Even if the game is just for the display, if the server logic is easily replicable, there's nothing that stops bad actors to develop custom clients to gain advantages in your game and skip your "legitimate" client completely, or even using your "client shell" for their own games being operated underground, or worse, having them using the "shell renderer" Godot game to reverse-engineer the API and bypass the game client completely.

GODOG adds extra tasks to those bad actors that try to take advantage of your Godot project, and also provides better ways to manage source code and build toolchains to build games (especially online titles) with or without hybrid architecture (developing client & server bundles with single source base).

---

### Prerequisites
Make sure that you have Node.JS 21.6.2 or newer.

Clone this project, and clone/download Godot's source code from the Godot repository. Don't forget to check/switch branch if the version you use matches with the version that you're using to develop the game.

`cd` to the root of the source code directory, then run this command:

```sh
node src/labels.gen.mjs /path/to/the/godot/source/code/directory
```

If you're using other OSes (such as Windows) and have Node.JS installed, this also does work:

```powershell
node src/labels.gen.mjs C:\path\to\godot\source\code\directory
```

It will start generating possible Godot labels the best effort it can, this need to be run only once. You can also delete the Godot source code after this action.

If you don't want to waste your time building labels cache yourself, here's pre-generated cache. Download, extract, and place it in the directory of GODOG.

[godot_labels_cache.zip (3.5.3)](https://github.com/user-attachments/files/16138291/godot_labels_cache.zip)

---

### Using GODOG
It's better to make sure that your project is compatible with GODOG, simply run the command below:

```sh
# Dry Run.
node src/main.mjs /path/to/your/project
```

If you're using other OSes (such as Windows) and have Node.JS installed, this also does work:

```powershell
node src/main.mjs C:\path\to\your\project
```

To start converting the project into a scrambled one, run the command below:

```sh
# Export the project in standalone mode.
node src/main.mjs /path/to/your/project /path/to/target/directory
```

If you're using other OSes (such as Windows) and have Node.JS installed, this also does work:

```powershell
node src/main.mjs C:\path\to\your\project C:\path\to\target\directory
```

This will generate a new Godot project from `/path/to/your/project` into `/path/to/target/directory`. Also, there will be two files generated into `/path/to/your/project`.
- `dbg.sym.json`, a file contains all debug symbols generated.
- `godog.json`, a configuration file.

---

### GODOG Configuration
There are few configurations that GODOG offer to fine-tune its behaviour. The configuration file will be generated in the project on the first run, or simply create a file named `godog.json` in the project's root directory.

Then write the file in JSON fashion as usual.

```js
{
    "scrambleGodotFiles": true, // This tells if GODOG will completely scramble TSCN, TRES, and GDScript file locations.
    "removeTypeCasting": false, // This tells GODOG to also remove type castings.
    "noExportParams": false, // This tells GODOG to strip away export parameters.
    "keepIgnoreBlocks": false, // This tells GODOG to keep all blocks in `#GODOG_IGNORE`.
    "ignoreCrucialPreprocessors": false // This will tell GODOG to skip crucial preprocessors completely.
}
```

- `scrambleGodotFiles`: `boolean`
Tells GODOG to move all Godot documents (`.gd`, `.tscn`, `.tres`) into the project's root directory. This usually doesn't cause any issues as long as you don't make any attempts to access resource files using string formatting methods.
- `removeTypeCasting`: `boolean`
Tells GODOG to remove type castings from your code. This can be unpreferable since this tends to break code. During type casting, Godot will also try to convert value during parameter passings to specified type. Without type casting, values may be left as-is and become especially unsafe to deal with especially with JSON objects. If you are willing to fix your code for sake of more obscure source exports, enable this option.
- `noExportParams`: `boolean`
Tells GODOG to strip away all export parameters. Not only that it helps stripping away code blocks that Godot doesn't care during runtime (albeit, very small portion), it's also very useful in case you don't want game hackers/modders to mess around with main script files and scenes. However, this introduces a side effect that it will break game's scripts if export variable isn't type-casted properly.

```gdscript
# Before.
export(NodePath) var button_path

# After. Godot has no idea how to recognise this variable and will give an error.
export var aa
```

To workaround this issue, simply type-cast variables directly if possible

```gdscript
# Before.
export var button_path: NodePath
export(String, FILE, "*.tscn") var next_scene_path := ""

# After.
export var mv: NodePath
export var xZ := ""
```

- `keepIgnoreBlocks`: `boolean`
Tells GODOG to keep all blocks in `#GODOG_IGNORE`. **This should always be disabled unless you absolutely know what you're doing.**
- `ignoreCrucialPreprocessors`: `boolean`
Tells GODOG to skip processing crucial preprocessors completely, notably client & server preprocessors. **This should always be disabled unless you absolutely know what you're doing.**

---

### Additional Macros
GODOG also supports some in-line preprocessors. It detects GDScript comments and try to parse it if the condition meets.

#### 1. Private Field Mangler
This GDScript macro indentifies any labels that the user want it to be private fields, this help complicating source restoration even more, but also introduces a phenomenon where it causes errors if the field is accessed outside of a script file.

You don't need to add private labels for function parameters and local variables (`var` in function bodies). They'll be automatically recognised and mangled.

```gdscript
#GODOG_PRIVATE:_velocity
```

*WARNING: You can't use private labels in string paths even if the said path is in the same file as the label. It's in this way by the nature of pretty much any 🦆 (dynamically typed) programming/scripting languages. There's no way around that.*


#### 2. Labels Ignore
Sometimes you still want "some" labels to be exposed and be used by other toolings, or simply wanting the game to have modding support without exposing everything in the game for both source compactness and especially more refined way to isolate APIs between ones with modding support (+stable and predictable environment) and others that you want to make changes freely with less worrying about breaking user's mods.

GODOG provides `#GODOG_EXPOSE` for this purpose. It also supports multiple names in a same line.


```gdscript
class_name GameAPI
#GODOG_EXPOSE: GameAPI

#GODOG_EXPOSE: query_nodes, query_name
func query_nodes(query_name: String) -> Array:
	# Entire leftover source code that could be vaguely
	# represented since GODOG will conitnue to buther them.
```

#### 3. Preprocessors
This helps removing code blocks that don't need to be exported in the production releases, like debug blocks and tests.

Simply use `#GODOG_IGNORE` between lines to tell GODOG to ignore lines inside the block:

```gdscript
var number = 1 + 2
#GODOG_IGNORE
if number == 3:
    print("the number is actually 3!")
#GODOG_IGNORE
return number
```

GODOG also supports client & server preprocessors to help exporting hybrid client-server applications easier. Simply use `#GODOG_CLIENT` for client exports and `#GODOG_SERVER` for server exports. Take a look at this example.

```gdscript
class_name TestGdScript


func MultiParamFunc(
	param1: String,
	param2: float,
	param3: bool,
	param4: int
) -> Dictionary:
	print(1 + 2)
	#GODOG_SERVER
	print(" this is server code. ")
	#GODOG_SERVER
	#GODOG_CLIENT
	print(" this is client code. ")
	#GODOG_CLIENT
	#GODOG_IGNORE
	print(" this is going to disappear. ")
	#GODOG_IGNORE
	print(" this is going to stay. ")
	return {
		MyName = "test",
		MyParam = [
			0,
			1,
			2,
			3,
		],
		MyNestedParam = {
			#GODOG_EXPOSE: A, B
			Person1 = "A",
			Person2 = "B",	# This comment should disappear.
		}
	}
```

After exporting, this is what it looks like in a client export:

```gdscript
class_name hX

func a3(VM,Bs,VB,g4):
	print(1+2)
	print(" this is client code. ")
	print(" this is going to stay. ")
	return{y3="test",QJ=[0,1,2,3,],Tg={UI="A",GO="B",}}
```

And this is what it looks like in a server export:

```gdscript
class_name hX

func a3(VM,Bs,VB,g4):
	print(1+2)
	print(" this is server code. ")
	print(" this is going to stay. ")
	return{y3="test",QJ=[0,1,2,3,],Tg={UI="A",GO="B",}}
```

However, this will NOT work by default because GODOG will try to prevent source leaks if command line arguments options aren't satisfied. This time, GODOG requires at least three parameters to export the project properly:

```sh
# Export the project to client & server bundles.
node node src/main.mjs /path/to/your/project /path/to/client/directory /path/to/server/directory
```

This will now allow the project to be exporetd.

#### 4. Ignoring Files
GODOG provides two ways to ignore entire directory. The first one is by adding `godogignore` this tells Godot to see files inside, but will be ignored in the export release. Second one is by adding `godogclient` and `godogserver`. This instead will help isolating between server and client resource exports.

#### 5. Ignoring GDScript Files
Sometimes you want some GDScript files to be in its original location in case where you need portable serialisation (notably, game loading and saving scripts, and savable resource files). Adding `#GODOG_EXPOSE_FILE` anywhere in the file will tell GODOG to keep its location intact.

However, this option WON'T ignore the content of the file and will still scramble user labels inside it. You still need to fine tune what should be exposed manually.

```gdscript
extends Resource
class_name GameSave
#GODOG_EXPOSE_FILE

#GODOG_EXPOSE: player_name, player_level
export var player_name := ""
export var player_level := 1
```

---

### CAUTION (MUST READ)
Since this project involves a complete string manipulation, it may introduce undesirable side effects from such procedure, and this could cause both representation problems (the game displays scrambled text), or **rendering API communications and data read/write** on storage **completely broken**, **or rendering the game unplayable**.

First and foremost, Unless it's absolutely intentional for reasons (see below), **DO NOT name strings with anything but Latin characters (a-z, A-Z), numbers, and underscore (`_`)**, since GODOG can't detect it efficiently, especially in Godot resource (`.tscn`/`.tres`) files.

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

Automated binary serialisation with built-in Godot functions will be completely broken. While it's not apparent on the first but in the next export revisions, named string entries will get swapped and break binary serialisation. This is not an issue in the past with games that run in machine code because most of them involve manual binary serialisation without string labels.

**If your game uses binary serialisation functions from Godot (such as `bytes2var` and `var2bytes`) for game saving, DON'T USE GODOG OR IT'LL CORRUPT YOUR SAVE FILES EVERY TIME YOUR GAME UPDATES.** If possible, don't even use this way of game saving because it introduces buffer overflow attack to the machine.

JSON serialisation generally works with GODOG, but all strings will be butchered, including ones inside string syntaxes:

```gdscript
{
    player_info = {
		# Yes, all of these will be scrambled, including ones inside string syntaxes.
        "player_name": "Player",
        "experience": 0,
        "inventory": {
            # blah, blah blah.
        }
    }
}

# Accessing Fields
json.player_info.player_name
```

As you may already noticed, this exposes user-defined strings directly into GDScript source code without any additional `#GODOG_EXPOSE` preprocessors, and GODOG will note them as user-defined labels and WILL SCRAMBLE THEM. This means that the game's save will only remain compatible for only one version of your game, and render API calls completely impossible since string names are altered. Fortunately, there are ways to workaround this issue. By converting the syntax to JSON-like will workaround this issue. Adding special characters to the string names will also help. Considering the snippet above, converting it gives this result instead:

```gdscript
var json := {
    "@player_info": { # using '@' to avoid the string getting mangled.
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

Another way around this is also by using `#GODOG_EXPOSE`, however this feature will expose the label "everywhere", not just the file that `#GODOG_EXPOSE` sits in.

```gdscript
#GODOG_EXPOSE: player_info, player_name, experience, inventory
{
    player_info = {
        "player_name": "Player",
        "experience": 0,
        "inventory": {
            # blah, blah blah.
        }
    }
}

# Accessing Fields
json.player_info.player_name
```

Noting that this way, your game's code will become easier to read when getting decompiled in the end, but nothing could be done in this case (except if you utilise translations tables, see below). However, if you're expecting GODOG to help scrambling API calls that will be used on server APIs, it's recommended to use debug symbols to help translating tables into readable data in the API sides, as it'll be explained in later section.

---

### Working With Protocol Paths (Files, URLs)
Normally, GODOG will not interact with file paths especially if the path also contains file extensions (such as `images/icon.png`). While this generally works, if you split it up into small chunks during string processing, it'll very likely mess up the string. To avoid this issue, use string formatting to interact with file paths instead.

```gdscript
"https://sea.men/api/v3/load_player/%s" % player_name # GODOG will keep the URL intact.
"https://sea.men/api/v3/" + "load_player" + "/" % player_name # GODOG will mess up the "load_player" label, unless it's ignored.

str("https://sea.men/api/v3/load_player/", player_name) # GODOG is happy with this.
str("https://sea.men/api/v3/", "load_player", "/", player_name) # Depending on how you want to achieve it, but this generally doesn't work out right.
```

Also, with the same princicple, it also refuses to modifly Godot's `NodePath`s with partially formatted names:

```gdscript
"/root/MyScene/Enemies/%s" % enemy_name # GODOG will help format the name.
"/root/MyScene/Enemies/Enemy%s" % enemy_name # GODOG will IGNORE this.
```

*TLDR; Always use full protocol paths for file names in the code. If impossible, store it in translation files.*

---

### Working With Game Server APIs
Since GODOG aims at scrambling strings in Godot projects. This makes some of implementations such as API calls completely butchered. The mitigation is already explained as above. But GODOG also exports a complete JSON of "debug symbols" that can be used for remappings. It also offers bi-directional translation, which means this can be used to translate strings in both ways. To utilise it on API game servers, simply import and use it to convert mangled keys into readable keys. Here's an example of JavaScript-based implementation of the translator:

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

However, this also leaves a vulnerability where the API can be exposed by some sort of mapping attack. Which means everything that involve custom strings should always be verified with the imported debug symbols that if it contains strings in the translation table and flag it as illegal operation.

Here's an example of JavaScript implementation of the verifier:

```js
/**
 * Check if the translator key exists.
 * @param {Record<string,string>} dict 
 */
function trKeyExists(dict) {
    /** @param {string[]} strings */
    return (...strings) => {
        for (const s of strings) {
            if (dict[s]) return true;
        }
        return false;
    };
}

// An example to detect bad inputs in username & password input.
trKeyExists(dict)(username, password);
```

Another way to prevent this attack is to make the API server demand string length more than maximum size of minified strings. Usually, for small-medium sized projects, GODOG generates labels with length around 4 characters or less. However, if the game has in-game chat and it's expected to have less than 4 characters per message in occasions, simply add empty space characters to the payload to workaround the issue.

```js
if (username.length < 4 || password.length < 4) {
	response(400, "Invalid username or password.");
}

"no" -> "no  "    // add 2 empty space characters.
"yes" -> "yes "   // add 1 empty space characters.
"maybe" -> "maybe" // add no empty space characters.
```

---

### TIP: Using "Wrong" GDScript Name Styles
Because following style guides in GDScript increases risks of user labels hitting Godot internal labels, making this tool less effective. To help on this, using "these" style guides will help GODOG identifying user labels a lot easier.

- `PascalCase` for publicily accessible labels and function names.
- `_PascalCase` (with an underscore in front of it) for privately accessible labels. 
- `_camelCase` (with an underscore in front of it) for local labels.

Here's an example of how this will work:
```gdscript
extends Node

#GODOG_PRIVATE: _Target
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

### TIP: Using Translation Table To Store Texts
It may sound absurd, but translation mechanism involves determining which strings that will be used or uses some sort of hash tables. This way helps the source to dissociate relations between scripts and readable descriptions, making it more difficult to search for specific implementations. Godot's built-in `TranslationServer` works really well in this regard. In the translation CSV, putting string keys in quadruple underscores to indicate GODOG that keys must be mangled.

```csv
"key","en"
"GREETING","Hello world!"
```

After GODOG manages to mangle CSV files, Godot also automatically converts  the mangled CSV table into loadable binary and leave the CSV files in PCK exports.

However, the disadvantage of this approach is that Godot's `TranslationServer` is in-memory. If the project has a lot of paragraph worthy of strings (depending on the project's size), it could instead be very undesirable to have them in the memory (especially on HTML5 platform). GODOG also offers a translator that helps on stream-based translations.

To integrate disk-based translations. GODOG offers a syntax that helps in this regard. This can be done in any TSCN/TRES files by putting translation keys in `----- LOCALE -----` brackets:

```
----- LOCALE -----
"en": "Hello!"
"es": "¡Hola!"
"de": "Hallo!"
"fr": "Bonjour!"
"cn": "你好!"
"ja": "こんにちは！"
"th": "สวัสดี!"
----- LOCALE -----
```

You must always put quote symbols (`"`) around text, and if you need to put quotation marks in it, you must use `\"` instead (e.g., `"Hello"` will become `\"Hello\"`). You also CANNOT put any line breaks between elements, or the translation will NOT work.

#### Here's the WRONG example.
Looks nice and clean, but IT WON'T WORK.

```
----- LOCALE -----

"en": "Hello!"

"es": "¡Hola!"

"de": "Hallo!"

"fr": "Bonjour!"

"cn": "你好!"

"ja": "こんにちは！"

"th": "สวัสดี!"

----- LOCALE -----
```

In debug environment, the translator will automatically convert this sequence into translation maps, and automatically pick the one that matches user's locale. This process is kinda slow if you have many supported languages, but it shouldn't be an issue in debug environment. In the export environment, GODOG pre-compiles all lists of strings in project files into pre-computed hash maps stored in a PCK file. The translation function will instead load the string according to user's locale immediately without any additional conversions.

To translate strings using this functionality, use `Tr.Dsk()` function from `translator.gd` (stored in `gd` directory of this repo):

```gdscript
Tr.Dsk(resource_object.text_hello)
```

Unlike Godot's translation function, this translation function works differently since it involves no unique key. Which means the style of `Tr.Dsk("greeting")` will not work with this function. It's on this design since it's intended to handle large strings in resource files.

**You also need to add `.txt` for `Fileters to export non-resource files/folders` in `Export Presets -> Resources` in order to get it working properly.**

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
- Only works with Godot 3.x at the moment (Godot 4.x may work, but it's not tested).
- GDScript is the only supported scripting langauge.
- **Resource mapping with string formatting will not work!**
	(Example: `"res://scn/scn_game_%d.tscn" % index`, `"Path/To/My/Node%d" % index`)
- Shaders aren't tested. If it seems to break, workaround it by `#GODOG_EXPOSE` with its named parameters.
- **It loves destroying GUI strings. To avoid the issue, store readable strings in translation files instead.**

---

### Future Improvements
Since this implementation already works well enough for me, I'll only improve stability and increment API versions of Node.JS & libraries. However, feel free to open up issues or pull requests in case if you want to improve this project (such as Godot 4 support).

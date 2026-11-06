# The Flock map

## You only need two things

**1. Change the content → the `content/` folder**

| File | What it controls |
|---|---|
| `content/overview.html` | The intro text on the first screen |
| `content/more-info.html` | The "More info" pop-up in the top bar: intro text and links |
| `content/how-data-is-shared.html` | The pop-up window with the general "how the data is used and shared" facts |
| `content/campuses/<campus>.html` | One page per campus (e.g. `unca.html`) |
| `content/campuses/_copy-me.html` | A template: copy it to start a new campus page |

You can edit these in any text editor. Only change the words between the `<` `>` tags.

**2. Change the look → `content/style.css`**

Colors and fonts are the named values at the very top of the file.

## Please leave alone: `code/`

The map itself, the camera data and the campus overlay. It all works without edits.

## Viewing your changes

In a terminal, in the folder above `map/`, run `python3 -m http.server`,
then open http://localhost:8000/map/index.html and refresh after each save.

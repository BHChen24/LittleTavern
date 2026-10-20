# Examples

An original character card and lorebook for trying LittleTavern. They are based on Lewis Carroll's
*Alice's Adventures in Wonderland* (1865) and *Through the Looking-Glass* (1871), which are in the
public domain, and are not affiliated with any film, game or other adaptation.

| File | What it is |
|---|---|
| `characters/alice.json` | **Alice**, as a Character Card V3. Three greetings: the hall of doors, the Mad Tea-Party and the Queen's croquet-ground |
| `lorebooks/wonderland.json` | **Wonderland**, a SillyTavern world-info lorebook with ten entries: one always on, eight triggered by keywords, and one disabled |

## Try them

```bash
littletavern import examples/characters/alice.json examples/lorebooks/wonderland.json
littletavern
```

Then, in the app:

1. `/characters` and choose Alice.
2. `/attach` and choose Wonderland.
3. Talk about the Cheshire Cat, the Queen or the Hatter, then open `/trace`. It shows which
   Wonderland entries were sent, which keyword triggered each one, and why the others were not:
   no keyword yet, or disabled, like the Jabberwock.

## License

These two files are dedicated to the public domain under [CC0 1.0](LICENSE): copy, change and
share them freely, no attribution needed. The rest of LittleTavern is under the MIT license.

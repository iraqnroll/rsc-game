# rsc-game

The RuneScape Classic game that [RSC Editor](https://github.com/iraqnroll/rsc-editor)
publishes to: the 2003scape web client and servers, in one repository so a
change to the protocol can land on both sides in one commit.

| folder | what | upstream |
|---|---|---|
| `rsc-client/` | the web client (browserify bundle in `dist/`) | [2003scape/rsc-client](https://github.com/2003scape/rsc-client) |
| `rsc-server/` | the game server | [2003scape/rsc-server](https://github.com/2003scape/rsc-server) |
| `rsc-data-server/` | accounts, saves, friends | [2003scape/rsc-data-server](https://github.com/2003scape/rsc-data-server) |

Each folder carries its upstream history. All three are AGPL-3.0+: anyone who
plays on a server running modified code is entitled to its source, which is
one reason this repository is public.

## Run it locally

```sh
(cd rsc-data-server && npm install)
(cd rsc-server && npm install)
(cd rsc-client && npm install && npm run build-dev)
./run.sh                      # http://localhost:1337/index.html
(cd rsc-server && npm test)   # the command table's tests
./load-export.sh <export.zip> # then restart ./run.sh
```

After changing anything under `rsc-client/src`, rebuild with
`npm run build-dev` (the server install does this itself).

**Do not commit `rsc-client/dist/data204`** after loading an export into it:
it is the cache this repository ships, and loading an export overwrites it in
place. `./load-export.sh --restore` puts it back.

## Staff and :: commands

Accounts have a rank: 0 player, 2 moderator, 3 administrator. Commands need
at least moderator; a player below the rank gets no answer at all. Set a
rank while that player is **logged out** (the game saves rank back on
logout):

```sh
cd rsc-data-server && npm run set-rank -- some_player 3
# on the server: node src/set-rank.js some_player 3 /etc/rsc-game/data-server.json
```

In game, `::help` lists what your rank can use and `::help give` explains one
command. Names with spaces are typed with underscores; items and NPCs can be
given by id or name, and `::find item rune scimitar` looks ids up.

| rank | commands |
|---|---|
| moderator | `::help`, `::find`, `::coords`, `::kick`, `::goto`, `::teleport` |
| administrator | `::give`, `::item`, `::npc`, `::addexp`, `::setqp`, `::setquest`, `::shop`, `::bank`, `::clearinventory`, `::appearance`, `::fatigue`, `::dmg`, `::droprandom`, and the debug ones (`::help` lists them) |

The table lives in `rsc-server/src/commands/index.js`; every command there
states its rank, arguments, help line and an example. Every attempt, allowed
or not, is logged.

## On the server

RSC Editor's `deploy/game/install.sh` clones this repository to
`/opt/rsc-game` and runs it; running it again deploys the latest `main`.
Caches arrive through the editor's Publish button. See the editor's
`deploy/README.md`, "The game server".

## Pulling upstream changes

```sh
git remote add upstream-server https://github.com/2003scape/rsc-server.git
git fetch upstream-server
git merge -X subtree=rsc-server upstream-server/master
```

The same for `rsc-client` and `rsc-data-server`.

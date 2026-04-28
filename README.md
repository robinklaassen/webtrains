# Webtrains

New web version of our famous visualisation of trains in the Dutch landscape, using Three.js.

## Development
I use `nvm` on WSL to manage Node versions. Activate the LTS version of node and then it's just `npm install` and away! If you don't have or like WSL, you can use `nvm-windows` instead.

Serve a local development version (with hot reloading) with `npm run dev`.

If you want to contribute, please make sure your code is formatting and linted using `npm run fix` before committing. This is checked by a Github Actions pipeline and will block the PR if it fails.

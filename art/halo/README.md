# Halo

The sprite set behind the thirteenth appearance layer (`rsc-server/src/halo.js`):
a gold ring over the head of every new player, which a quest takes away.

- `halo.png` -- the sheet, 15 walk frames and 3 attack frames, 1260x204.
- `halo-grey.png` -- the same sheet in grey, to be tinted by the animation's
  colour instead of being gold.
- `preview.png`, `preview-zoom.png` -- the halo drawn over head1 in every
  frame; not used by the game.

## Adding it to a cache

In RSC Editor, Assets -> NPC sprite sets, upload `halo.png` under the name
`halo` with **rows = 2**, then add an animation definition named `halo`, colour
`rgb(0, 0, 0)`, genderModel 13, hasA true, hasF false. Its index has to be 255
or less, because a layer travels as one byte in the appearance message.

Upload the sheet as it is. The client draws attack frames 84/64 wider than
walk frames and centres them, so the halo's position in the attack row already
makes up for that (`x_halo = 1.3125 * x_head - 13.125`). Cropping or
rearranging the sheet puts the halo beside the head instead of over it.

hasA is on so the halo survives a fight -- layers without it are not drawn in
combat. hasF is off: a halo mirrors onto itself, so the flipped-facing frames
would be nine copies of the same thing.

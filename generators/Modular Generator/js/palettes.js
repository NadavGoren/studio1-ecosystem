/* palettes.js — the ONE fixed 10-pen palette. These are Nadav's actual
   Pilot pen colours; they are not editable and there are no alternative
   presets. `paper` is the preview background only (never exported — the
   plotter draws on real paper). `baseIndex` is the dominant "field" pen
   used by the Motif and Pixel modes (Light Blue). */
(function () {
  window.MOD = window.MOD || {};

  MOD.PALETTE = {
    paper: '#ECE4D6',
    baseIndex: 2, // Light Blue
    colors: [
      { name: 'Black', hex: '#1A1A1A' },
      { name: 'Dark Blue', hex: '#21478F' },
      { name: 'Light Blue', hex: '#6FB1DA' },
      { name: 'Green', hex: '#2F9E54' },
      { name: 'Yellow', hex: '#F3C016' },
      { name: 'Orange', hex: '#F08A2C' },
      { name: 'Red', hex: '#E23B2E' },
      { name: 'Pink', hex: '#E85C97' },
      { name: 'Purple', hex: '#7A4FA3' },
      { name: 'Brown', hex: '#835432' },
    ],
  };
})();

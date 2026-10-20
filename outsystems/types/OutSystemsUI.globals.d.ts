// Global type aliases that OutSystemsUI.d.ts refers to. In the OutSystems UI repository they live in
// src/scripts/Global.d.ts and depend on the bundled libraries (Splide, Flatpickr, noUiSlider); here the
// provider-specific ones are loosened to `any`, since the org chart provider never uses them.
/* eslint-disable @typescript-eslint/no-explicit-any */
type ProviderConfigs = any;
type ProviderInfo = {
	name: string;
	version: string;
	events: ProviderConfigs;
};
type GradientColor = { Color: string; Percentage: number };
type MonthYear = { Month: string; Year: number };
type Orientation = any;
type ScrollPosition = any;
type OffsetValues = { bottom?: number; left?: number; right?: number; top?: number };
type OutOfBoundaries = { bottom: boolean; left: boolean; right: boolean; top: boolean };
type BalloonAnchor = unknown;
type DragEvents = any;
type SwipeEvents = any;

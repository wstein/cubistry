// Locators and actions of the Workflow slot of the hosted CI Quality Cube: chip rows (radio groups) and the speed slider.
export const SPEED_STOPS = [2000, 1000, 500, 250, 100, 50, 10];
export const chipOf = (page, category, state) => page.locator(`#status-${category}-${state}`);
export const choose = (page, category, state) => chipOf(page, category, state).click();
export const setSpeed = (page, ms) => page.locator("#status-speed").fill(String(SPEED_STOPS.indexOf(ms)));

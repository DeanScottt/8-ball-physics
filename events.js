import {
  init,
	cue,
	stepPhysics,
	startSimulation,
	gameStates,
	canvasRect,
	attemptPlacement
} from "./app.js"

import {
  debugOverlay,
	white,
	renderBall,
	clearCanvas,
	render
} from "./graphics.js"



document.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "`":
			return debugOverlay();
    case "Escape":
      return init();
		case "p":
			return stepPhysics();
		case " ":
			return startSimulation();
    default:
      return;
  }
});



document.addEventListener("mousemove", (event) => {
	if (!cue) return;

	if (cue.shooting) {
		if (!cue.charging && !cue.animating) {
			cue.rotate(event.clientX, event.clientY);
		} else {
			cue.charge(event.clientX, event.clientY);
		}
	}

	if (gameStates.placeMode) {
		clearCanvas();
		render();
		renderBall(event.clientX - canvasRect.left, event.clientY - canvasRect.top, white, 0);
	}

});



document.addEventListener("mousedown", (event) => {
	if (!cue || !cue.shooting) return;
	cue.xCharge = event.clientX;
	cue.yCharge = event.clientY;
	cue.charging = true;
});



document.addEventListener("mouseup", (event) => {
	if (!cue || !cue.shooting) return;
	cue.charging = false;
	if (cue && cue.power > 0) {
		cue.shoot();
	}
});



document.addEventListener("click", (event) => {
	if (gameStates.placeMode) {
		attemptPlacement(event.clientX - canvasRect.left, event.clientY - canvasRect.top);
	}
});
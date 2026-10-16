const canvas = document.querySelector(".playCanvas");
const ctx = canvas.getContext("2d");

export {
	debugOverlay,
	debugDots,
	render,
	clearCanvas,
	red,
	yellow,
	white,
	black,
	ballRadius,
	canvas,
	debugMode,
	renderBall,
	drawRay
};

import {
  ballData,
  wallData,
	gameStates,
	CueBall,
	cue,
} from "./app.js"



//* Constants
const red = "#BB1000";
const yellow = "#CC9000";
const white = "#DDF";
const black = "#111111";
const ballRadius = 26;

//* States
let	debugMode = false;

//* Data
let debugDots = [];



function debugOverlay(forceOn = false) {
  if (debugMode && !forceOn) {
		debugMode = false;
		ctx.reset();
		render();
		return;
	}

	debugMode = true;

	//* Wall boundaries and normals
	for (const wall of wallData) {
		ctx.shadowBlur = 0;
		ctx.strokeStyle = "#A0F";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(wall.x1, wall.y1);
		ctx.lineTo(wall.x2, wall.y2);
		ctx.stroke();

		const xMid = (wall.x1 + wall.x2) >> 1;
		const yMid = (wall.y1 + wall.y2) >> 1;
		const vectorLength = wall.len / 6;
		const xOut = xMid + wall.nx * vectorLength;
		const yOut = yMid + wall.ny * vectorLength;
		const xAlong = xMid + (wall.xDir * vectorLength);
		const yAlong = yMid + (wall.yDir * vectorLength);

		ctx.strokeStyle = "#F00";
		ctx.beginPath();
		ctx.moveTo(xMid, yMid);
		ctx.lineTo(xOut, yOut);
		ctx.stroke();
		ctx.strokeStyle = "#0F0";
		ctx.beginPath();
		ctx.moveTo(xMid, yMid);
		ctx.lineTo(xAlong, yAlong);
		ctx.stroke();
	}



	//* Corner positions
	ctx.fillStyle = "#FFF";
	ctx.font = "20px Arial";
	ctx.fillText("132, 187", 137, 197);
	ctx.fillText("94, 149", 99, 159);
	ctx.fillText("187, 132", 192, 142);
	ctx.fillText("149, 94", 154, 104);
	drawDebugDot(132, 187, 5);
	drawDebugDot(94, 149, 5);
	drawDebugDot(187, 132, 5);
	drawDebugDot(149, 94, 5);

	ctx.fillStyle = "#FFF";
	ctx.fillText("906, 132", 911, 142);
	ctx.fillText("944, 94", 949, 104);
	ctx.fillText("1093, 132", 1098, 142);
	ctx.fillText("1055, 94", 1060, 104);
	drawDebugDot(906, 132, 5);
	drawDebugDot(944, 94, 5);
	drawDebugDot(1093, 132, 5);
	drawDebugDot(1055, 94, 5);

	ctx.fillStyle = "#FFF";
	ctx.fillText("1812, 132", 1817, 142);
	ctx.fillText("1850, 94", 1855, 104);
	ctx.fillText("1867, 187", 1872, 197);
	ctx.fillText("1905, 149", 1910, 159);
	drawDebugDot(1812, 132, 5);
	drawDebugDot(1850, 94, 5);
	drawDebugDot(1867, 187, 5);
	drawDebugDot(1905, 149, 5);

	ctx.fillStyle = "#FFF";
	ctx.fillText("132, 812", 137, 822);
	ctx.fillText("94, 850", 99, 860);
	ctx.fillText("187, 867", 192, 877);
	ctx.fillText("149, 905", 154, 915);
	drawDebugDot(132, 812, 5);
	drawDebugDot(94, 850, 5);
	drawDebugDot(187, 867, 5);
	drawDebugDot(149, 905, 5);

	ctx.fillStyle = "#FFF";
	ctx.fillText("906, 867", 911, 877);
	ctx.fillText("944, 905", 949, 915);
	ctx.fillText("1093, 867", 1098, 877);
	ctx.fillText("1055, 905", 1060, 915);
	drawDebugDot(906, 867, 5);
	drawDebugDot(944, 905, 5);
	drawDebugDot(1093, 867, 5);
	drawDebugDot(1055, 905, 5);

	ctx.fillStyle = "#FFF";
	ctx.fillText("1812, 867", 1817, 877);
	ctx.fillText("1850, 905", 1855, 915);
	ctx.fillText("1867, 812", 1872, 822);
	ctx.fillText("1905, 850", 1910, 860);
	drawDebugDot(1812, 867, 5);
	drawDebugDot(1850, 905, 5);
	drawDebugDot(1867, 812, 5);
	drawDebugDot(1905, 850, 5);



	//* Pocket positions
	ctx.strokeStyle = "#FFF";
	ctx.lineWidth = 1.5;
	ctx.beginPath();

	ctx.moveTo(149, 94);
	ctx.arc(94, 94, 55, 0, Math.PI * 2);

	ctx.moveTo(1055, 94);
	ctx.arc(1000, 94, 55, 0, Math.PI * 2);

	ctx.moveTo(1960, 94);
	ctx.arc(1905, 94, 55, 0, Math.PI * 2);

	ctx.moveTo(149, 905);
	ctx.arc(94, 905, 55, 0, Math.PI * 2);

	ctx.moveTo(1055, 905);
	ctx.arc(1000, 905, 55, 0, Math.PI * 2);

	ctx.moveTo(1960, 905);
	ctx.arc(1905, 905, 55, 0, Math.PI * 2);
	ctx.stroke();



	//* Velocity Vectors
	for (const ball of ballData) {
		const xOut = ball.x + (ball.xVel / 10);
		const yOut = ball.y + (ball.yVel / 10);

		if (gameStates.physicsLoop) {
			ctx.strokeStyle = "#F8A";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(ball.x, ball.y);
			ctx.lineTo(xOut, yOut);
			ctx.stroke();
		}
		
		ctx.strokeStyle = "#CAF";
		ctx.moveTo(ball.x, ball.y);
		ctx.beginPath();
		ctx.arc(ball.x, ball.y, ballRadius - 1.5, 0, Math.PI * 2);
		ctx.stroke();
	}
}


function drawDebugDot(x, y, r, color = "#0FF") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}



const clearCanvas = () => ctx.clearRect(0, 0, canvas.width, canvas.height);




function renderBall(x, y, color, fallDepth) {
  let gradient;
  if (color === black) {
    gradient = ctx.createLinearGradient(x - ballRadius, y - ballRadius * 2, x + ballRadius, y + ballRadius * 2);
  } else {
    gradient = ctx.createLinearGradient(x - ballRadius / 2, y - ballRadius * 1.3, x + ballRadius / 2, y + ballRadius * 1.3);
  }
  gradient.addColorStop(0, color === black ? "#888" : "#FFF");
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, "#000");
  
  ctx.fillStyle = gradient;
  ctx.shadowColor = "#000";
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, ballRadius - fallDepth), 0, Math.PI * 2);
  ctx.fill();
}



function render() {
	clearCanvas();
  for (const ball of ballData) {
		if (ball.pocketed) continue;
    renderBall(ball.x, ball.y, ball.color, ball.fallDepth);
  }
	if (debugMode) { debugOverlay(true) };
	if (gameStates.physicsLoop) { requestAnimationFrame(render) };
}


function drawRay(length, nx = null, ny = null) {
	// collision ghost center
	const xOut = CueBall.x + cue.nx * length;
	const yOut = CueBall.y + cue.ny * length;
	const reciprocalLength = 200;

	render();

	// draw ray
	ctx.beginPath();
	ctx.strokeStyle = "#FFFFFFAA";
	ctx.lineWidth = ballRadius / 4;
	ctx.shadowColor = "transparent";
	ctx.moveTo(CueBall.x, CueBall.y);
	ctx.lineTo(xOut, yOut);
	ctx.stroke();

	if (nx !== null) {
		const gradient = ctx.createLinearGradient(
			xOut,
			yOut,
			xOut + reciprocalLength * nx,
			yOut + reciprocalLength * ny,
		);
		gradient.addColorStop(0, "#FFFFFFAA");
		gradient.addColorStop(0.3, "#FFFFFFAA");
		gradient.addColorStop(0.5, "#FFFFFF70");
		gradient.addColorStop(1, "#FFFFFF00");
		ctx.strokeStyle = gradient;

		// draw reciprocal angle
		ctx.beginPath();
		ctx.moveTo(xOut, yOut);
		ctx.lineTo(xOut + reciprocalLength * nx, yOut + reciprocalLength * ny);
		ctx.stroke();

		ctx.strokeStyle = "#FFFFFFAA";
	}

	// clear collision ghost area
	ctx.shadowColor = "transparent";
	ctx.beginPath();
	ctx.globalCompositeOperation = "destination-out";
	ctx.arc(xOut, yOut, ballRadius, 0, Math.PI * 2);
	ctx.fill();

	// draw collision ghost
	ctx.beginPath();
	ctx.globalCompositeOperation = "source-over";
	ctx.arc(xOut, yOut, ballRadius - ballRadius / 8, 0, Math.PI * 2);
	ctx.stroke();

	// paste ball on top of rays
	renderBall(CueBall.x, CueBall.y, white, 0);
}
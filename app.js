export {
	init,
	ballData,
	wallData,
	pocketData,
	cue,
	CueBall,
	stepPhysics,
	startSimulation,
	gameStates,
	canvasRect,
	attemptPlacement
};

import {
	clearCanvas,
	render,
	red,
	yellow,
	white,
	black,
	ballRadius,
	canvas,
	drawRay
} from "./graphics.js";

const canvasRect = canvas.getBoundingClientRect();
const pocketRadius = 55;

const gameStates = {
	physicsLoop: null,
	placeMode: false
}

//* Data Lists
let ballData = [];
const wallData = [];
const pocketData = [];

//* Physics Params
const tableDrag = 0.4;
const cushionRestitution = 0.9;
const ballRestitution = 0.9;
const lowVelocityLimit = 20;
const maxPower = 5000;
const maxCuePullback = 300;

const maxCollisionsPerTick = 200;
const deltaT = 1 / 120;
const subTickFractionLimit = 1e-6;
const subtickOverlapCorrectionTollerance = 1;
const pocketDrag = 1;
const pocketRestitution = 0.8;
const ballDropSpeedThreshold = 100;
const fallDepthLimit = 30;

//* Special Objects
const cueElement = document.querySelector(".cue");
let CueBall;
let ball8;
let cue;

function animate(duration, onFrame, onComplete) {
	const start = performance.now();
	const curved = (t) => t ** 4;

	function step(now) {
		const t = Math.min(1, (now - start) / duration);
		onFrame(curved(t));

		if (t < 1) {
			return requestAnimationFrame(step);
		}
		if (onComplete) {
			onComplete();
		}
	}

	requestAnimationFrame(step);
}

//* Game Objects

class Ball {
	constructor(x, y, color) {
		this.color = color;
		this.xPrev = x;
		this.yPrev = y;
		this.x = x;
		this.y = y;
		this.xVel = 0;
		this.yVel = 0;
		this.speed = 0;
		this.atRest = true;
		this.reach = ballRadius;

		this.captive = false;
		this.sinking = false;
		this.fallDepth = 0;
		this.pocketed = false;
		this.pocket = null;

		this.tickRemaining = 1;
	}
}

class Cue {
	constructor() {
		this.x = 0;
		this.y = 0;
		this.power = 0;
		this.rotation = 0;
		this.nx = 0;
		this.ny = 0;
		this.yCharge = 0;
		this.xCharge = 0;

		this.shooting = false;
		this.charging = false;
		this.animating = false;
	}

	toggle() {
		this.shooting = !this.shooting;
		if (this.shooting) {
			this.x = CueBall.x - 18;
			this.y = CueBall.y + ballRadius + 2;
			this.nx = 1;
			this.ny = 0;

			cueElement.style.left = `${this.x}px`;
			cueElement.style.top = `${this.y}px`;
			cueElement.style.setProperty("transform", `rotate(${this.rotation + 90}deg)`);
			cueElement.style.display = "block";
		} else {
			cueElement.style.display = "none";
		}
	}

	rotate(mouseX, mouseY) {
		const dx = CueBall.x + canvasRect.left - mouseX;
		const dy = CueBall.y + canvasRect.top - mouseY;

		const radians = Math.atan2(dy, dx);
		this.nx = Math.cos(radians);
		this.ny = Math.sin(radians);
		this.rotation = (radians * (180 / Math.PI) + 360) % 360;

		ballData.forEach(ball => ball.tickRemaining = 1/deltaT);

		CueBall.xPrev = CueBall.x;
		CueBall.yPrev = CueBall.y;
		CueBall.xVel = this.nx * 3000;
		CueBall.yVel = this.ny * 3000;
		CueBall.speed = 3000;
		CueBall.reach = ballRadius + 3000 * deltaT * CueBall.tickRemaining;
		CueBall.atRest = false;
		generateRayCast();

		cueElement.style.setProperty("transform", `rotate(${this.rotation + 90}deg)`);
	}

	charge(mouseX, mouseY) {
		const dx = this.xCharge - mouseX;
		const dy = this.yCharge - mouseY;
		const normalDistance = dx * this.nx + dy * this.ny;
		this.power = Math.min(Math.max((normalDistance / maxCuePullback) * maxPower, 0), maxPower);

		cueElement.style.translate = `${(this.power / maxPower) * -this.nx * maxCuePullback}px ${(this.power / maxPower) * -this.ny * maxCuePullback}px`;
	}

	shoot() {
		this.animating = true;
		CueBall.atRest = false;
		CueBall.xVel = this.power * this.nx;
		CueBall.yVel = this.power * this.ny;
		CueBall.speed = Math.hypot(CueBall.xVel, CueBall.yVel);
		this.power = 0;
		this.rotation = 0;

		const [cueStartX, cueStartY] = cueElement.style.translate.split(" ").map(parseFloat);
		const [targetX, targetY] = [this.nx * 15, this.ny * 15];
		animate(
			300,
			(curved) => {
				const x = cueStartX + (targetX - cueStartX) * curved;
				const y = cueStartY + (targetY - cueStartY) * curved;
				cueElement.style.translate = `${x}px ${y}px`;
			},
			() => {
				this.toggle();
				this.animating = false;
				cueElement.style.translate = "";
				startSimulation();
			},
		);
	}
}

class Wall {
	constructor(x1, y1, x2, y2) {
		const xDeltaRaw = x2 - x1;
		const yDeltaRaw = y2 - y1;

		this.len = Math.hypot(xDeltaRaw, yDeltaRaw);

		this.xDir = xDeltaRaw / this.len;
		this.yDir = yDeltaRaw / this.len;
		this.nx = -this.yDir;
		this.ny = this.xDir;

		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2;
		this.y2 = y2;
	}
}

//* Init and main loops

function generateWallNormals() {
	wallData.push(new Wall(906, 132, 944, 94));
	wallData.push(new Wall(187, 132, 906, 132));
	wallData.push(new Wall(149, 94, 187, 132));

	wallData.push(new Wall(1812, 132, 1850, 94));
	wallData.push(new Wall(1093, 132, 1812, 132));
	wallData.push(new Wall(1055, 94, 1093, 132));

	wallData.push(new Wall(187, 867, 149, 905));
	wallData.push(new Wall(906, 867, 187, 867));
	wallData.push(new Wall(944, 905, 906, 867));

	wallData.push(new Wall(1093, 867, 1055, 905));
	wallData.push(new Wall(1812, 867, 1093, 867));
	wallData.push(new Wall(1850, 905, 1812, 867));

	wallData.push(new Wall(94, 850, 132, 812));
	wallData.push(new Wall(132, 812, 132, 187));
	wallData.push(new Wall(132, 187, 94, 149));

	wallData.push(new Wall(1867, 812, 1905, 850));
	wallData.push(new Wall(1867, 187, 1867, 812));
	wallData.push(new Wall(1905, 149, 1867, 187));

	for (const wall of wallData) {
		for (const neighbour of wallData) {
			if (wall.x1 === neighbour.x2 && wall.y1 === neighbour.y2) {
				wall.startNeighbour = neighbour;
			}
			if (wall.x2 === neighbour.x1 && wall.y2 === neighbour.y1) {
				wall.endNeighbour = neighbour;
			}
		}
		wall.startNeighbour = wall.startNeighbour || null;
		wall.endNeighbour = wall.endNeighbour || null;
	}
}

function generatePocketData() {
	pocketData.push(
		{ x: 94, y: 94, type: "corner" },
		{ x: 1000, y: 94, type: "middle" },
		{ x: 1905, y: 94, type: "corner" },
		{ x: 94, y: 905, type: "corner" },
		{ x: 1000, y: 905, type: "middle" },
		{ x: 1905, y: 905, type: "corner" },
	);
}

function generateRayCast() {
	let earliestHit = CueBall.checkWallCollisions();
	const ballHits = getAllBallCollisions();
	if (ballHits) {
		ballHits.sort((a, b) => a.hit.collisionTime - b.hit.collisionTime);
		if (!earliestHit || ballHits[0].hit.collisionTime < earliestHit.collisionTime) earliestHit = ballHits[0].hit;
	}
	
	if (earliestHit !== null) {
		const dist = 3000 * earliestHit.collisionTime / CueBall.tickRemaining;
		const xEnd = CueBall.x + dist * cue.nx;
		const yEnd = CueBall.y + dist * cue.ny;
		let nx = 0;
		let ny = 0;
		
		if (earliestHit.collisionType === "ball") {
			nx = (earliestHit.collisionTarget.x - xEnd) / (ballRadius * 2);
			ny = (earliestHit.collisionTarget.y - yEnd) / (ballRadius * 2);
			
		} else if (earliestHit.collisionType === "corner") {
			const xToCorner = (xEnd - earliestHit.collisionTarget.x) / ballRadius;
			const yToCorner = (yEnd - earliestHit.collisionTarget.y) / ballRadius;
			const nVel = cue.nx * xToCorner + cue.ny * yToCorner;
			nx = cue.nx - 2 * nVel * xToCorner;
			ny = cue.ny - 2 * nVel * yToCorner;
			
		} else if (earliestHit.collisionType === "wall") {
			const nVel = cue.nx * earliestHit.collisionTarget.nx + cue.ny * earliestHit.collisionTarget.ny;
			nx = cue.nx - 2 * nVel * earliestHit.collisionTarget.nx;
			ny = cue.ny - 2 * nVel * earliestHit.collisionTarget.ny;
		}
		
		drawRay(dist, nx, ny);
	} else {
		//* Pocket hit
		return;
	}
}

function init() {
	clearInterval(gameStates.physicsLoop);
	gameStates.physicsLoop = null;
	ballData = [];
	clearCanvas();
	const xStart = 1452;
	const yStart = 500;
	const dx = (54 / 30) * ballRadius;
	const dy = (31 / 30) * ballRadius;

	CueBall = new Ball(547, yStart, white);
	ballData.push(CueBall);

	ballData.push(new Ball(xStart, yStart, red));

	ballData.push(new Ball(xStart + dx, yStart - dy, red));
	ballData.push(new Ball(xStart + dx, yStart + dy, yellow));

	ballData.push(new Ball(xStart + dx * 2, yStart - dy * 2, yellow));
	ball8 = new Ball(xStart + dx * 2, yStart, black);
	ballData.push(ball8);
	ballData.push(new Ball(xStart + dx * 2, yStart + dy * 2, red));

	ballData.push(new Ball(xStart + dx * 3, yStart - dy * 3, red));
	ballData.push(new Ball(xStart + dx * 3, yStart - dy, yellow));
	ballData.push(new Ball(xStart + dx * 3, yStart + dy, red));
	ballData.push(new Ball(xStart + dx * 3, yStart + dy * 3, yellow));

	ballData.push(new Ball(xStart + dx * 4, yStart - dy * 4, yellow));
	ballData.push(new Ball(xStart + dx * 4, yStart - dy * 2, red));
	ballData.push(new Ball(xStart + dx * 4, yStart, yellow));
	ballData.push(new Ball(xStart + dx * 4, yStart + dy * 2, yellow));
	ballData.push(new Ball(xStart + dx * 4, yStart + dy * 4, red));

	// ballData.push(new Ball(xStart + dx * 5, yStart - dy * 5, yellow));
	// ballData.push(new Ball(xStart + dx * 5, yStart - dy * 3, red));
	// ballData.push(new Ball(xStart + dx * 5, yStart - dy, red));
	// ballData.push(new Ball(xStart + dx * 5, yStart + dy, yellow));
	// ballData.push(new Ball(xStart + dx * 5, yStart + dy * 3, red));
	// ballData.push(new Ball(xStart + dx * 5, yStart + dy * 5, red));
	
	// ballData.push(new Ball(xStart + dx * 6, yStart - dy * 6, yellow));
	// ballData.push(new Ball(xStart + dx * 6, yStart - dy * 4, red));
	// ballData.push(new Ball(xStart + dx * 6, yStart - dy * 2, yellow));
	// ballData.push(new Ball(xStart + dx * 6, yStart, yellow));
	// ballData.push(new Ball(xStart + dx * 6, yStart + dy * 2, red));
	// ballData.push(new Ball(xStart + dx * 6, yStart + dy * 4, yellow));
	// ballData.push(new Ball(xStart + dx * 6, yStart + dy * 6, red));
	
	// ballData.push(new Ball(xStart + dx * 7, yStart - dy * 7, yellow));
	// ballData.push(new Ball(xStart + dx * 7, yStart - dy * 5, yellow));
	// ballData.push(new Ball(xStart + dx * 7, yStart - dy * 3, yellow));
	// ballData.push(new Ball(xStart + dx * 7, yStart - dy, yellow));
	// ballData.push(new Ball(xStart + dx * 7, yStart + dy, yellow));
	// ballData.push(new Ball(xStart + dx * 7, yStart + dy * 3, yellow));
	// ballData.push(new Ball(xStart + dx * 7, yStart + dy * 5, yellow));
	// ballData.push(new Ball(xStart + dx * 7, yStart + dy * 7, yellow));

	// ballData.push(new Ball(xStart + dx * 8, yStart - dy * 8, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart - dy * 6, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart - dy * 4, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart - dy * 2, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart + dy * 2, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart + dy * 4, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart + dy * 6, yellow));
	// ballData.push(new Ball(xStart + dx * 8, yStart + dy * 8, yellow));

	// ballData.push(new Ball(xStart + dx * 9, yStart - dy * 9, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart - dy * 7, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart - dy * 5, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart - dy * 3, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart - dy, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart + dy, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart + dy * 3, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart + dy * 5, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart + dy * 7, yellow));
	// ballData.push(new Ball(xStart + dx * 9, yStart + dy * 9, yellow));

	// ballData.push(new Ball(xStart + dx * 10, yStart - dy * 10, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart - dy * 8, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart - dy * 6, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart - dy * 4, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart - dy * 2, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart + dy * 2, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart + dy * 4, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart + dy * 6, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart + dy * 8, yellow));
	// ballData.push(new Ball(xStart + dx * 10, yStart + dy * 10, yellow));

	ballData.sort((a, b) => Math.random() < 0.5);

	render();
	cue = new Cue();
	cueElement.style.transformOrigin = `18px ${(ballRadius + 2) * -1}px`;
	cue.toggle();
}

function resolveTick() {
	for (const ball of ballData) {
		ball.tickRemaining = 1;
		ball.reach = ballRadius + ball.speed * deltaT;
	}

	const activeBalls = ballData.filter((ball) => !ball.atRest && !ball.pocketed && !ball.captive);

	let candidatePool = [];
	for (const ball of activeBalls) {
		const hit = ball.checkWallCollisions();
		if (hit) candidatePool.push({ ball, hit, absoluteTime: hit.collisionTime });
		const ballCollisions = getAllBallCollisions();
		if (ballCollisions !== null) candidatePool.push(...ballCollisions);
	}

	let collisionCount = 0;
	while (candidatePool.length && collisionCount++ < maxCollisionsPerTick) {
		let earliestCollisionIndex = 0;
		for (let i = 0; i < candidatePool.length; i++) {
			if (candidatePool[i].absoluteTime < candidatePool[earliestCollisionIndex].absoluteTime) {
				earliestCollisionIndex = i;
			}
		}

		//* take earliest collision and process it
		const winner = candidatePool[earliestCollisionIndex];
		applyCollision(winner.ball, winner.hit);

		const collidedBalls = [winner.ball];
		const affectedBalls = new Set();

		//* update values for collided ball mid tick
		winner.ball.tickRemaining -= winner.hit.collisionTime;
		if (winner.ball.tickRemaining < subTickFractionLimit) winner.ball.tickRemaining = 0;
		winner.ball.xPrev = winner.ball.x;
		winner.ball.yPrev = winner.ball.y;
		winner.ball.speed = Math.hypot(winner.ball.xVel, winner.ball.yVel);
		winner.ball.reach = ballRadius + winner.ball.speed * deltaT * winner.ball.tickRemaining;

		//* do the same for other ball if collision was ball-ball
		if ((winner.hit.collisionType === "ball")) {
			const otherBall = winner.hit.collisionTarget;
			collidedBalls.push(otherBall);
			affectedBalls.add(otherBall);
			otherBall.tickRemaining -= winner.hit.collisionTime;
			if (otherBall.tickRemaining < subTickFractionLimit) otherBall.tickRemaining = 0;
			otherBall.xPrev = otherBall.x;
			otherBall.yPrev = otherBall.y;
			otherBall.speed = Math.hypot(otherBall.xVel, otherBall.yVel);
			otherBall.reach = ballRadius + otherBall.speed * deltaT * otherBall.tickRemaining;
		}

		//* Cull projected collisions that involved any collided ball(s)
		candidatePool = candidatePool.filter(candidate => {
			const isStale = (collidedBalls.includes(candidate.ball) || collidedBalls.includes(candidate.hit.collisionTarget));
			if (isStale) affectedBalls.add(candidate.ball);
			return !isStale;
		});

		for (const ball of affectedBalls) {
			if (ball.tickRemaining <= 0) continue;
			const newHit = ball.checkWallCollisions();
			if (newHit) {
				const absoluteTime = (1 - ball.tickRemaining) + newHit.collisionTime;
				candidatePool.push({ ball, hit: newHit, absoluteTime });
			}
		}
		
		const newBallCollisions = updateBallCollisionCandidates([...affectedBalls]);
		if (newBallCollisions !== null) {candidatePool.push(...newBallCollisions)};
	}

	let simulationOver = true;
	for (const ball of ballData) {
		if (ball.tickRemaining > 0) {
			ball.x += ball.xVel * deltaT * ball.tickRemaining;
			ball.y += ball.yVel * deltaT * ball.tickRemaining;
		}

		if (!ball.captive) {
			ball.checkPocketStatus();
		} else if (!ball.pocketed) {
			ball.updateCaptiveBall();
			ball.checkPocketCollisions();
		}

		ball.xPrev = ball.x;
		ball.yPrev = ball.y;

		ball.xVel *= 1 - tableDrag * deltaT;
		ball.yVel *= 1 - tableDrag * deltaT;
		ball.speed = Math.hypot(ball.xVel, ball.yVel);

		if ((ball.speed < lowVelocityLimit && !ball.sinking) || ball.pocketed) {
			ball.xVel = 0;
			ball.yVel = 0;
			ball.speed = 0;
			ball.atRest = true;
		} else {
			simulationOver = false;
		}
	}

	return simulationOver;
}

//* Pocket handling

Ball.prototype.checkPocketStatus = function () {
	if (this.y > 149 && this.y < 850) {
		return;
	}

	for (const pocket of pocketData) {
		const dx = this.x - pocket.x;
		const dy = this.y - pocket.y;
		const dist = Math.hypot(dx, dy);

		if (dist > pocketRadius) {
			if (dist < 250) {
				break;
			}
			continue;
		}

		this.pocket = pocket;
		this.captive = true;

		if (this.speed < 200) {
			const nx = dx / dist;
			const ny = dy / dist;
			const nVel = -200;
			this.xVel = nVel * nx;
			this.yVel = nVel * ny;
		}
	}
};

Ball.prototype.updateCaptiveBall = function () {
	if (!this.sinking) {
		this.xVel *= 1 - pocketDrag * deltaT;
		this.yVel *= 1 - pocketDrag * deltaT;

		if (this.speed < ballDropSpeedThreshold) {
			this.sinking = true;
		}
	} else {
		this.fallDepth += deltaT * 60;
		if (this.fallDepth >= fallDepthLimit) {
			this.pocketed = true;
		}
	}
};

Ball.prototype.checkPocketCollisions = function () {
	const collisionDistance = pocketRadius - ballRadius;
	const dx = this.x - this.pocket.x;
	const dy = this.y - this.pocket.y;
	const dist = Math.hypot(dx, dy);

	if (dist < collisionDistance) {
		return;
	}

	const nx = dx / dist;
	const ny = dy / dist;
	const nVel = this.xVel * nx + this.yVel * ny;

	if (nVel <= 0) {
		return;
	}
	const overlap = dist - collisionDistance;

	this.x -= overlap * nx;
	this.y -= overlap * ny;

	this.xVel -= (1 + pocketRestitution) * nVel * nx;
	this.yVel -= (1 + pocketRestitution) * nVel * ny;
};

//* Collision logic

function applyCollision(ball, hit) {
	switch (hit.collisionType) {
		case "wall":
			return applyWallBounce(ball, hit.collisionTarget, hit.collisionTime);
		case "corner":
			return applyCornerBounce(ball, hit.collisionTarget, hit.collisionTime);
		case "ball":
			return applyBallCollision(ball, hit.collisionTarget, hit.collisionTime);
	}
}

Ball.prototype.checkWallCollisions = function () {
	let collisionType = null;
	let collisionTime = null;
	let collisionTarget = null;

	for (const wall of wallData) {
		const closest = getDistanceAndClosestPoint(this, wall);
		if (closest.dist > this.reach) {
			continue;
		}

		const wallTime = getWallCollisionTime(this, wall);
		if (wallTime !== null && (collisionTime === null || wallTime < collisionTime)) {
			collisionTime = wallTime;
			collisionType = "wall";
			collisionTarget = wall;
		}

		const corner = closest.point <= 0.5 ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };
		const distanceToCorner = Math.hypot(this.x - corner.x, this.y - corner.y);

		if (distanceToCorner <= this.reach) {
			const cornerTime = getCornerCollisionTime(this, corner);
			if (cornerTime !== null && (collisionTime === null || cornerTime < collisionTime)) {
				collisionTime = cornerTime;
				collisionType = "corner";
				collisionTarget = corner;
			}
		}
	}

	return collisionType !== null ? { collisionType, collisionTarget, collisionTime } : null;
};

function getWallCollisionTime(ball, wall) {
	const relX = ball.xPrev - wall.x1;
	const relY = ball.yPrev - wall.y1;
	const signedDistance = relX * wall.nx + relY * wall.ny;
	const normalVel = (ball.xVel * wall.nx + ball.yVel * wall.ny) * deltaT;
	if (normalVel >= 0) return null; // no approach being made towards walls face
	const time = (ballRadius - signedDistance) / normalVel;
	if (time < -subTickFractionLimit || time > ball.tickRemaining) return null; // no collision for this step

	// now check if collision actually occurs on face of wall
	const xImpact = ball.xPrev + ball.xVel * time * deltaT;
	const yImpact = ball.yPrev + ball.yVel * time * deltaT;
	const point = projectToWall({ x: xImpact, y: yImpact }, wall);
	if (point <= 0 || point >= 1) return null; // outside wall segment, not a wall hit

	return time;
}

function getCornerCollisionTime(ball, corner) {
	const relativeX = ball.xPrev - corner.x;
	const relativeY = ball.yPrev - corner.y;

	const nVel = relativeX * ball.xVel + relativeY * ball.yVel;
	if (nVel >= 0) return null; // moving away from or tangent to corner, no collision

	const a = (ball.xVel ** 2 + ball.yVel ** 2) * deltaT ** 2;
	if (a < 1e-10) return null;
	const b = 2 * (relativeX * ball.xVel * deltaT + relativeY * ball.yVel * deltaT);
	const c = relativeX ** 2 + relativeY ** 2 - ballRadius ** 2;

	const discriminant = b ** 2 - 4 * a * c;
	if (discriminant < 0) return null; // never came into contact with corner

	const sqrtDisc = Math.sqrt(discriminant);
	const t1 = (-b - sqrtDisc) / (2 * a);
	const t2 = (-b + sqrtDisc) / (2 * a);

	if (t1 >= -subTickFractionLimit && t1 <= ball.tickRemaining) return t1;
	if (t2 >= -subTickFractionLimit && t2 <= ball.tickRemaining) return t2; // should never trigger;

	return null;
}

function applyWallBounce(ball, wall, time) {
	const xImpact = ball.xPrev + ball.xVel * time * deltaT;
	const yImpact = ball.yPrev + ball.yVel * time * deltaT;
	const nVel = ball.xVel * wall.nx + ball.yVel * wall.ny;

	ball.xVel -= (1 + cushionRestitution) * nVel * wall.nx;
	ball.yVel -= (1 + cushionRestitution) * nVel * wall.ny;

	ball.x = xImpact;
	ball.y = yImpact;
}

function applyCornerBounce(ball, corner, time) {
	const xImpact = ball.xPrev + ball.xVel * time * deltaT;
	const yImpact = ball.yPrev + ball.yVel * time * deltaT;

	const nx = (xImpact - corner.x) / ballRadius;
	const ny = (yImpact - corner.y) / ballRadius;

	const nVel = ball.xVel * nx + ball.yVel * ny;

	ball.xVel -= (1 + cushionRestitution) * nVel * nx;
	ball.yVel -= (1 + cushionRestitution) * nVel * ny;

	ball.x = xImpact;
	ball.y = yImpact;
}

function projectToWall(ball, wall) {
	const relativeX = ball.x - wall.x1;
	const relativeY = ball.y - wall.y1;
	const rawFraction = (relativeX * wall.xDir + relativeY * wall.yDir) / wall.len;
	return Math.min(Math.max(rawFraction, 0), 1);
}

function getDistanceAndClosestPoint(ball, wall) {
	const point = projectToWall(ball, wall);
	const xClosest = wall.x1 + wall.xDir * wall.len * point;
	const yClosest = wall.y1 + wall.yDir * wall.len * point;
	const dx = ball.x - xClosest;
	const dy = ball.y - yClosest;
	return { dist: Math.hypot(dx, dy), point };
}

function getAllBallCollisions() {
	const candidateList = [];

	for (let i = 0; i < ballData.length - 1; i++) {
		const ballA = ballData[i];
		if (ballA.captive) continue;

		for (let j = i + 1; j < ballData.length; j++) {
			const ballB = ballData[j];
			if (ballB.sinking || (ballA.atRest && ballB.atRest)) continue;

			const dx = ballA.x - ballB.x;
			const dy = ballA.y - ballB.y;
			if (Math.hypot(dx, dy) > ballA.reach + ballB.reach) continue;

			const time = getBallCollisionTime(ballA, ballB);
			if (time === null) continue;

			candidateList.push({ ball: ballA, hit: {collisionType: "ball", collisionTarget: ballB, collisionTime: time} });
		}
	}

	return candidateList.length ? candidateList : null;
}

function updateBallCollisionCandidates(drivers) {
	const candidateList = [];

	for (let i = 0; i < drivers.length; i++) {
		const ballA = drivers[i];
		if (ballA.sinking) continue;

		for (const ballB of ballData) {
			if (ballA === ballB) continue;
			if (ballB.sinking) continue;
			const idx = drivers.indexOf(ballB);
			if (idx >= 0 && idx < i) continue;

			const dx = ballA.x - ballB.x;
			const dy = ballA.y - ballB.y;
			if (Math.hypot(dx, dy) > ballA.reach + ballB.reach) continue;

			const time = getBallCollisionTime(ballA, ballB);
			if (time === null) continue;

			candidateList.push({ ball: ballA, hit: {collisionType: "ball", collisionTarget: ballB, collisionTime: time} });
		}
	}

	return candidateList.length ? candidateList : null;
}

function getBallCollisionTime(ballA, ballB) {
	const relX = ballA.xPrev - ballB.xPrev;
	const relY = ballA.yPrev - ballB.yPrev;
	const relVelX = ballA.xVel - ballB.xVel;
	const relVelY = ballA.yVel - ballB.yVel;

	const approachRate = relX * relVelX + relY * relVelY;
	if (approachRate >= 0) return null;
		
	const a = (relVelX**2 + relVelY**2) * deltaT**2;
	if (a < 1e-10) return null;
	const b = 2 * (relX * relVelX * deltaT + relY * relVelY * deltaT);
	const c = relX**2 + relY**2 - (ballRadius * 2)**2;

	const discriminant = b**2 - 4 * a * c;
	if (discriminant < 0) return null;

	const sqrtDisc = Math.sqrt(discriminant);
	const t1 = (-b - sqrtDisc) / (2 * a);

	const minTickRemaining = Math.min(ballA.tickRemaining, ballB.tickRemaining);
	if (t1 > minTickRemaining) return null;

	if (t1 < 0) {
		const dx = ballA.xPrev - ballB.xPrev;
		const dy = ballA.yPrev - ballB.yPrev;
		const dist = Math.hypot(dx, dy);
		if (dist < ballRadius * 2 + subtickOverlapCorrectionTollerance) return 0;
		return null;
	}

	return t1;
}

function applyBallCollision(ballA, ballB, time) {
	const xImpactA = ballA.xPrev + ballA.xVel * time * deltaT;
	const yImpactA = ballA.yPrev + ballA.yVel * time * deltaT;
	const xImpactB = ballB.xPrev + ballB.xVel * time * deltaT;
	const yImpactB = ballB.yPrev + ballB.yVel * time * deltaT;

	const dx = xImpactA - xImpactB;
	const dy = yImpactA - yImpactB;
	const dist = Math.hypot(dx, dy);
	const nx = dx / dist;
	const ny = dy / dist;

	const relVelX = ballA.xVel - ballB.xVel;
	const relVelY = ballA.yVel - ballB.yVel;
	const relNormalVel = relVelX * nx + relVelY * ny;

	const impulse = (1 + ballRestitution) * relNormalVel / 2;

	ballA.xVel -= impulse * nx;
	ballA.yVel -= impulse * ny;
	ballB.xVel += impulse * nx;
	ballB.yVel += impulse * ny;

	ballA.x = xImpactA;
	ballA.y = yImpactA;
	ballB.x = xImpactB;
	ballB.y = yImpactB;

	if (ballA.xVel !== 0 || ballA.yVel !== 0) ballA.atRest = false;
	if (ballB.xVel !== 0 || ballB.yVel !== 0) ballB.atRest = false;
}

//* Simulation controllers

function startSimulation() {
	if (gameStates.physicsLoop) return;
	gameStates.physicsLoop = setInterval(tickPhysics, 1000 * deltaT);
	render();
}

function tickPhysics() {
	const simulationOver = resolveTick();

	if (simulationOver) {
		clearInterval(gameStates.physicsLoop);
		gameStates.physicsLoop = null;
		render();
		startNewTurn();
	}
}

function startNewTurn() {
	if (CueBall.pocketed) {
		CueBall.sinking = false;
		CueBall.captive = false;
		CueBall.pocket = null;
		CueBall.fallDepth = 0;
		gameStates.placeMode = true;
		canvas.style.cursor = "grabbing";
		document.body.style.cursor = "grab";
	} else {
		cue.toggle();
	}
}

function stepPhysics() {
	if (gameStates.physicsLoop) {
		clearInterval(gameStates.physicsLoop);
		gameStates.physicsLoop = null;
	}

	resolveTick();
	render();
}

function attemptPlacement(x, y) {
	if (x < 132 + ballRadius || x > 1867 - ballRadius) return;
	if (y < 132 + ballRadius || y > 867 - ballRadius) return;

	for (const ball of ballData) {
		if (ball.pocketed) continue;
		const dist = Math.hypot(x - ball.x, y - ball.y);
		if (dist < ballRadius) return;
	}

	CueBall.x = x;
	CueBall.y = y;
	CueBall.pocketed = false;
	gameStates.placeMode = false;
	canvas.style.cursor = "crosshair";
	document.body.style.cursor = "crosshair";
	render();
	cue.toggle();
}

////////////////////////////////////////////////////////////

generateWallNormals();
generatePocketData();

//* Parameter warning

if (maxPower * deltaT >= ballRadius * 2) {
	console.warn(
		"WARNING:",
		"\nMax power is too high for current deltaT!",
		`\nBall can move ${Math.trunc(((maxPower * deltaT) / ballRadius) * 100) / 100}x it's radius in one tick!`,
	);
}
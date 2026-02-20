(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const VIEW_WIDTH = canvas.width;
  const VIEW_HEIGHT = canvas.height;
  const TILE_SIZE = 64;
  const SOURCE_TILE = 32;
  const GRAVITY = 2200;

  const toAsset = (path) => encodeURI(path);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const keys = new Set();
  const justPressed = new Set();

  window.addEventListener("keydown", (event) => {
    const code = event.code;
    if (!keys.has(code)) justPressed.add(code);
    keys.add(code);

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  const isDown = (...codes) => codes.some((code) => keys.has(code));
  const wasPressed = (...codes) => codes.some((code) => justPressed.has(code));

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = toAsset(path);
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${path}`));
    });
  }

  function loadFrameSet(basePath, count) {
    const frames = [];
    for (let i = 1; i <= count; i += 1) {
      frames.push(loadImage(`${basePath}/${i}.png`));
    }
    return Promise.all(frames);
  }

  const levelRows = [
    "........................................................................................................................",
    "........................................................................................................................",
    "........................................................................................................................",
    "........................................................................................................................",
    "........................................................................................................................",
    "...................................===..................................................................................",
    ".........................===...........................===..............................................................",
    "............===..................................................====...................................................",
    "..................................................====....................................................===...........",
    ".............................====............................................................===.......................",
    "..........===....................................................====...................................................",
    "........................................................................................................................",
    "..........####....................####............................####...................................................",
    "........................................................................................................................",
    "@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@",
    "@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@",
    "@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@",
    "@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@....@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@"
  ];

  const world = {
    width: levelRows[0].length,
    height: levelRows.length,
    rows: levelRows
  };

  const worldPixelWidth = world.width * TILE_SIZE;
  const worldPixelHeight = world.height * TILE_SIZE;

  const tileLegend = {
    "#": { tile: 2, solid: true },
    "@": { tile: 12, solid: true },
    "=": { tile: 5, solid: true },
    ".": { tile: -1, solid: false }
  };

  function getTileAt(tx, ty) {
    if (ty < 0 || ty >= world.height || tx < 0 || tx >= world.width) return ".";
    return world.rows[ty][tx] || ".";
  }

  function isSolidTile(tx, ty) {
    const key = getTileAt(tx, ty);
    return tileLegend[key]?.solid || false;
  }

  const player = {
    x: 240,
    y: 120,
    w: 32,
    h: 52,
    vx: 0,
    vy: 0,
    facing: "right",
    onGround: false,
    jumpBuffer: 0,
    coyoteTime: 0,
    frameTime: 0,
    frameIndex: 0,
    spawnX: 240,
    spawnY: 120
  };

  const camera = {
    x: 0,
    y: 0
  };

  function resolveHorizontal(entity, dt) {
    entity.x += entity.vx * dt;

    const left = Math.floor(entity.x / TILE_SIZE);
    const right = Math.floor((entity.x + entity.w - 1) / TILE_SIZE);
    const top = Math.floor(entity.y / TILE_SIZE);
    const bottom = Math.floor((entity.y + entity.h - 1) / TILE_SIZE);

    if (entity.vx > 0) {
      for (let ty = top; ty <= bottom; ty += 1) {
        if (isSolidTile(right, ty)) {
          entity.x = right * TILE_SIZE - entity.w;
          entity.vx = 0;
          break;
        }
      }
    } else if (entity.vx < 0) {
      for (let ty = top; ty <= bottom; ty += 1) {
        if (isSolidTile(left, ty)) {
          entity.x = (left + 1) * TILE_SIZE;
          entity.vx = 0;
          break;
        }
      }
    }
  }

  function resolveVertical(entity, dt) {
    entity.y += entity.vy * dt;

    const left = Math.floor(entity.x / TILE_SIZE);
    const right = Math.floor((entity.x + entity.w - 1) / TILE_SIZE);
    const top = Math.floor(entity.y / TILE_SIZE);
    const bottom = Math.floor((entity.y + entity.h - 1) / TILE_SIZE);

    entity.onGround = false;

    if (entity.vy > 0) {
      for (let tx = left; tx <= right; tx += 1) {
        if (isSolidTile(tx, bottom)) {
          entity.y = bottom * TILE_SIZE - entity.h;
          entity.vy = 0;
          entity.onGround = true;
          break;
        }
      }
    } else if (entity.vy < 0) {
      for (let tx = left; tx <= right; tx += 1) {
        if (isSolidTile(tx, top)) {
          entity.y = (top + 1) * TILE_SIZE;
          entity.vy = 0;
          break;
        }
      }
    }
  }

  function updatePlayer(dt) {
    const moveLeft = isDown("ArrowLeft", "KeyA");
    const moveRight = isDown("ArrowRight", "KeyD");
    const jumpPressed = wasPressed("Space", "ArrowUp", "KeyW");

    const runSpeed = 300;
    const accel = 2100;
    const friction = 2300;

    if (moveLeft) {
      player.vx = Math.max(player.vx - accel * dt, -runSpeed);
      player.facing = "left";
    }

    if (moveRight) {
      player.vx = Math.min(player.vx + accel * dt, runSpeed);
      player.facing = "right";
    }

    if (!moveLeft && !moveRight) {
      if (player.vx > 0) {
        player.vx = Math.max(0, player.vx - friction * dt);
      } else if (player.vx < 0) {
        player.vx = Math.min(0, player.vx + friction * dt);
      }
    }

    if (jumpPressed) {
      player.jumpBuffer = 0.14;
    }

    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.coyoteTime = player.onGround ? 0.1 : Math.max(0, player.coyoteTime - dt);

    if (player.jumpBuffer > 0 && player.coyoteTime > 0) {
      player.vy = -860;
      player.onGround = false;
      player.coyoteTime = 0;
      player.jumpBuffer = 0;
    }

    player.vy += GRAVITY * dt;
    player.vy = Math.min(player.vy, 1400);

    resolveHorizontal(player, dt);
    resolveVertical(player, dt);

    if (player.y > worldPixelHeight + 400) {
      player.x = player.spawnX;
      player.y = player.spawnY;
      player.vx = 0;
      player.vy = 0;
    }
  }

  function updateCamera() {
    const targetX = player.x + player.w / 2 - VIEW_WIDTH / 2;
    const targetY = player.y + player.h / 2 - VIEW_HEIGHT / 2;

    camera.x += (targetX - camera.x) * 0.12;
    camera.y += (targetY - camera.y) * 0.08;

    camera.x = clamp(camera.x, 0, Math.max(0, worldPixelWidth - VIEW_WIDTH));
    camera.y = clamp(camera.y, 0, Math.max(0, worldPixelHeight - VIEW_HEIGHT));
  }

  function getAnimState() {
    if (!player.onGround) return "jump";
    if (Math.abs(player.vx) > 24) return "walk";
    return "idle";
  }

  function drawBackground(bgSky, ocean) {
    const skyScale = 2;
    const skyTileW = bgSky.width * skyScale;
    const skyTileH = bgSky.height * skyScale;
    const skyStartX = -((camera.x * 0.2) % skyTileW) - skyTileW;
    const skyStartY = -((camera.y * 0.15) % skyTileH) - skyTileH;

    for (let y = skyStartY; y < VIEW_HEIGHT + skyTileH; y += skyTileH) {
      for (let x = skyStartX; x < VIEW_WIDTH + skyTileW; x += skyTileW) {
        ctx.drawImage(bgSky, x, y, skyTileW, skyTileH);
      }
    }

    const oceanScale = 2.4;
    const oceanW = ocean.width * oceanScale;
    const oceanH = ocean.height * oceanScale;
    const oceanY = VIEW_HEIGHT - oceanH + 110;
    const oceanStartX = -((camera.x * 0.45) % oceanW) - oceanW;

    for (let x = oceanStartX; x < VIEW_WIDTH + oceanW; x += oceanW) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(ocean, x, oceanY, oceanW, oceanH);
      ctx.globalAlpha = 1;
    }
  }

  function drawTiles(tileSheet) {
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const key = world.rows[y][x];
        const tileData = tileLegend[key];
        if (!tileData || tileData.tile < 0) continue;

        const worldX = x * TILE_SIZE;
        const worldY = y * TILE_SIZE;

        if (
          worldX + TILE_SIZE < camera.x ||
          worldX > camera.x + VIEW_WIDTH ||
          worldY + TILE_SIZE < camera.y ||
          worldY > camera.y + VIEW_HEIGHT
        ) {
          continue;
        }

        const tile = tileData.tile;
        const sx = (tile % 10) * SOURCE_TILE;
        const sy = Math.floor(tile / 10) * SOURCE_TILE;

        ctx.drawImage(
          tileSheet,
          sx,
          sy,
          SOURCE_TILE,
          SOURCE_TILE,
          Math.floor(worldX - camera.x),
          Math.floor(worldY - camera.y),
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }
  }

  function drawPlayer(animations) {
    const state = getAnimState();
    const facing = player.facing;
    const frames = animations[state][facing];

    const frameDur = state === "walk" ? 0.09 : 0.16;
    player.frameTime += deltaTime;

    if (player.frameTime >= frameDur) {
      player.frameTime = 0;
      player.frameIndex = (player.frameIndex + 1) % frames.length;
    }

    if (state !== lastAnimState) {
      player.frameIndex = 0;
      player.frameTime = 0;
      lastAnimState = state;
    }

    const frame = frames[player.frameIndex % frames.length];

    const drawW = 92;
    const drawH = 92;
    const drawX = Math.floor(player.x - camera.x - (drawW - player.w) / 2);
    const drawY = Math.floor(player.y - camera.y - (drawH - player.h));

    ctx.drawImage(frame, drawX, drawY, drawW, drawH);
  }

  function drawDebugUI() {
    ctx.fillStyle = "rgba(8, 12, 24, 0.6)";
    ctx.fillRect(10, 10, 232, 56);

    ctx.fillStyle = "#eaf1ff";
    ctx.font = "14px monospace";
    ctx.fillText(`x:${player.x.toFixed(1)} y:${player.y.toFixed(1)}`, 20, 32);
    ctx.fillText(`vx:${player.vx.toFixed(1)} vy:${player.vy.toFixed(1)}`, 20, 52);
  }

  let lastTime = 0;
  let deltaTime = 0;
  let lastAnimState = "idle";

  function loop(time, resources) {
    const { tileSheet, bgSky, ocean, animations } = resources;

    if (!lastTime) lastTime = time;
    deltaTime = Math.min(0.033, (time - lastTime) / 1000);
    lastTime = time;

    updatePlayer(deltaTime);
    updateCamera();

    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawBackground(bgSky, ocean);

    ctx.save();
    drawTiles(tileSheet);
    drawPlayer(animations);
    ctx.restore();

    drawDebugUI();

    justPressed.clear();
    window.requestAnimationFrame((t) => loop(t, resources));
  }

  Promise.all([
    loadImage("Sprites/tilesetOpenGame.png"),
    loadImage("Sprites/tilesetOpenGameBackground.png"),
    loadImage("Sprites/Ocean_SpriteSheet.png"),
    loadFrameSet("Sprites/Cellin Base/standard/idle/right", 2),
    loadFrameSet("Sprites/Cellin Base/standard/idle/left", 2),
    loadFrameSet("Sprites/Cellin Base/standard/walk/right", 9),
    loadFrameSet("Sprites/Cellin Base/standard/walk/left", 9),
    loadFrameSet("Sprites/Cellin Base/standard/jump/right", 5),
    loadFrameSet("Sprites/Cellin Base/standard/jump/left", 5)
  ])
    .then((loaded) => {
      const [
        tileSheet,
        bgSky,
        ocean,
        idleRight,
        idleLeft,
        walkRight,
        walkLeft,
        jumpRight,
        jumpLeft
      ] = loaded;

      const animations = {
        idle: { right: idleRight, left: idleLeft },
        walk: { right: walkRight, left: walkLeft },
        jump: { right: jumpRight, left: jumpLeft }
      };

      window.requestAnimationFrame((t) =>
        loop(t, {
          tileSheet,
          bgSky,
          ocean,
          animations
        })
      );
    })
    .catch((error) => {
      console.error(error);
      ctx.fillStyle = "#fff";
      ctx.font = "18px sans-serif";
      ctx.fillText("Failed to load game assets. Check file paths in console.", 30, 60);
    });
})();

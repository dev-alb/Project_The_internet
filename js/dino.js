function showParagraph(id) {
    let count = 1
    let paragraph = document.getElementById(`paragraph-${count}`)

    while (!!paragraph) {

        if (count === id) { 
            if (paragraph.className === 'showing') {
                paragraph.className = 'hidden'
            } else {
                paragraph.className = 'showing'
            }
        } else {
            paragraph.className = 'hidden'
        }

        count ++
        paragraph = document.getElementById(`paragraph-${count}`)
    }
}

function changeTheme() {
    document.getElementsByTagName('body')[0].classList.toggle('white')
}


function update() {
    this.updatePending = false;

    const now = getTimeStamp();
    let deltaTime = now - (this.time || now);

    // Flashing when switching game modes.
    if (this.altGameModeFlashTimer < 0 || this.altGameModeFlashTimer === 0) {
      this.altGameModeFlashTimer = null;
      this.tRex.setFlashing(false);
      this.enableAltGameMode();
    } else if (this.altGameModeFlashTimer > 0) {
      this.altGameModeFlashTimer -= deltaTime;
      this.tRex.update(deltaTime);
      deltaTime = 0;
    }

    this.time = now;

    if (this.playing) {
      this.clearCanvas();

      // Additional fade in - Prevents jump when switching sprites
      if (this.altGameModeActive &&
          this.fadeInTimer <= this.config.FADE_DURATION) {
        this.fadeInTimer += deltaTime / 1000;
        this.canvasCtx.globalAlpha = this.fadeInTimer;
      } else {
        this.canvasCtx.globalAlpha = 1;
      }

      if (this.tRex.jumping) {
        this.tRex.updateJump(deltaTime);
      }

      this.runningTime += deltaTime;
      const hasObstacles = this.runningTime > this.config.CLEAR_TIME;

      // First jump triggers the intro.
      if (this.tRex.jumpCount === 1 && !this.playingIntro) {
        this.playIntro();
      }

      // The horizon doesn't move until the intro is over.
      if (this.playingIntro) {
        this.horizon.update(0, this.currentSpeed, hasObstacles);
      } else if (!this.crashed) {
        const showNightMode = this.isDarkMode ^ this.inverted;
        deltaTime = !this.activated ? 0 : deltaTime;
        this.horizon.update(
            deltaTime, this.currentSpeed, hasObstacles, showNightMode);
      }

      //obstacle.xPos + 1,
      //obstacle.yPos + 1,
      //obstacle.typeConfig.width * obstacle.size - 2,
      //obstacle.typeConfig.height - 2

      const newObstacle = this.horizon.obstacles.length > 0 ? {
        ...this.horizon.obstacles[0],
        xPos: this.horizon.obstacles[0].xPos - 40
      } : {}

      if (this.horizon.obstacles.length > 0 && checkForCollision(newObstacle, this.tRex)) {
        this.tRex.startJump(this.currentSpeed);
      }

      // Check for collisions.
      let collision = hasObstacles &&
          checkForCollision(this.horizon.obstacles[0], this.tRex);

      // For a11y, audio cues.
      if (Runner.audioCues && hasObstacles) {
        const jumpObstacle =
            this.horizon.obstacles[0].typeConfig.type != 'COLLECTABLE';

        if (!this.horizon.obstacles[0].jumpAlerted) {
          const threshold = Runner.isMobileMouseInput ?
              Runner.config.AUDIOCUE_PROXIMITY_THRESHOLD_MOBILE_A11Y :
              Runner.config.AUDIOCUE_PROXIMITY_THRESHOLD;
          const adjProximityThreshold = threshold +
              (threshold * Math.log10(this.currentSpeed / Runner.config.SPEED));

          if (this.horizon.obstacles[0].xPos < adjProximityThreshold) {
            if (jumpObstacle) {
              this.generatedSoundFx.jump();
            }
            this.horizon.obstacles[0].jumpAlerted = true;
          }
        }
      }

      // Activated alt game mode.
      if (Runner.isAltGameModeEnabled() && collision &&
          this.horizon.obstacles[0].typeConfig.type == 'COLLECTABLE') {
        this.horizon.removeFirstObstacle();
        this.tRex.setFlashing(true);
        collision = false;
        this.altGameModeFlashTimer = this.config.FLASH_DURATION;
        this.runningTime = 0;
        this.generatedSoundFx.collect();
      }

      if (!collision) {
        this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;

        if (this.currentSpeed < this.config.MAX_SPEED) {
          this.currentSpeed += this.config.ACCELERATION;
        }
      } else {
        this.gameOver();
      }

      const playAchievementSound = this.distanceMeter.update(deltaTime,
          Math.ceil(this.distanceRan));

      if (!Runner.audioCues && playAchievementSound) {
        this.playSound(this.soundFx.SCORE);
      }

      // Night mode.
      if (!Runner.isAltGameModeEnabled()) {
        if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
          this.invertTimer = 0;
          this.invertTrigger = false;
          this.invert(false);
        } else if (this.invertTimer) {
          this.invertTimer += deltaTime;
        } else {
          const actualDistance =
              this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));

          if (actualDistance > 0) {
            this.invertTrigger =
                !(actualDistance % this.config.INVERT_DISTANCE);

            if (this.invertTrigger && this.invertTimer === 0) {
              this.invertTimer += deltaTime;
              this.invert(false);
            }
          }
        }
      }
    }

    if (this.playing || (!this.activated &&
        this.tRex.blinkCount < Runner.config.MAX_BLINK_COUNT)) {
      this.tRex.update(deltaTime);
      this.scheduleNextUpdate();
    }
  }

  function checkForCollision(obstacle, tRex, opt_canvasCtx) {
    const obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;
  
    // Adjustments are made to the bounding box as there is a 1 pixel white
    // border around the t-rex and obstacles.
    const tRexBox = new CollisionBox(
        tRex.xPos + 1,
        tRex.yPos + 1,
        tRex.config.WIDTH - 2,
        tRex.config.HEIGHT - 2);
  
    const obstacleBox = new CollisionBox(
        obstacle.xPos + 1,
        obstacle.yPos + 1,
        obstacle.typeConfig.width * obstacle.size - 2,
        obstacle.typeConfig.height - 2);
  
    // Debug outer box
    if (opt_canvasCtx) {
      drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox);
    }
  
    // Simple outer bounds check.
    if (boxCompare(tRexBox, obstacleBox)) {
      const collisionBoxes = obstacle.collisionBoxes;
      let tRexCollisionBoxes = [];
  
      if (Runner.isAltGameModeEnabled()) {
        tRexCollisionBoxes = Runner.spriteDefinition.TREX.COLLISION_BOXES;
      } else {
        tRexCollisionBoxes = tRex.ducking ? Trex.collisionBoxes.DUCKING :
                                            Trex.collisionBoxes.RUNNING;
      }
  
      // Detailed axis aligned box check.
      for (let t = 0; t < tRexCollisionBoxes.length; t++) {
        for (let i = 0; i < collisionBoxes.length; i++) {
          // Adjust the box to actual positions.
          const adjTrexBox =
              createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
          const adjObstacleBox =
              createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
          const crashed = boxCompare(adjTrexBox, adjObstacleBox);
  
          // Draw boxes for debug.
          if (opt_canvasCtx) {
            drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
          }
  
          if (crashed) {
            return [adjTrexBox, adjObstacleBox];
          }
        }
      }
    }
  }

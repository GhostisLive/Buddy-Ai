class AvatarManager {
    constructor() {
        this.canvas = null;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.avatar = null;
        this.light = null;
        this.animations = {};
        this.currentAnimation = null;
        this.isTalking = false;
        this.initialized = false;
        this.cameraLocked = true; // Track camera lock state
    }

    async init() {
        try {
            this.setupCanvas();
            this.createScene();
            this.setupLights();
            this.setupCamera();
            
            await this.loadAvatar();
            
            // Add camera lock control icon after avatar is loaded
            this.createCameraLockIcon();
            
            this.setupResizeListener();
            this.startRenderLoop();
            this.initialized = true;
            
            console.log('Avatar initialized successfully');
        } catch (error) {
            console.error('Failed to initialize avatar:', error);
            this.showErrorMessage();
            throw error;
        }
    }

    setupCanvas() {
        // Get the container first
        const container = document.getElementById('avatar-canvas');
        if (!container) {
            throw new Error('Avatar canvas container not found');
        }
        
        // Clear the container
        container.innerHTML = '';
        
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.canvas.style.outline = 'none';
        container.appendChild(this.canvas);
        
        // Ensure the canvas has dimensions
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Initialize the Babylon engine
        this.engine = new BABYLON.Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        
        console.log(`Canvas initialized with dimensions: ${this.canvas.width}x${this.canvas.height}`);
    }

    createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        
        // Use a warmer background that matches the cozy UI theme
        this.scene.clearColor = new BABYLON.Color4(0.13, 0.1, 0.08, 1);
        
        // Subtle fog for depth and atmosphere - warm brown fog
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
        this.scene.fogDensity = 0.05;
        this.scene.fogColor = new BABYLON.Color3(0.13, 0.1, 0.08);
    }

    setupLights() {
        // Main hemisphere light for ambient illumination
        const hemisphericLight = new BABYLON.HemisphericLight(
            'hemisphericLight', 
            new BABYLON.Vector3(0, 1, 0), 
            this.scene
        );
        hemisphericLight.intensity = 0.7;
        hemisphericLight.diffuse = new BABYLON.Color3(1.0, 0.95, 0.85); // Warm golden tint
        hemisphericLight.specular = new BABYLON.Color3(0.3, 0.2, 0.1);
        hemisphericLight.groundColor = new BABYLON.Color3(0.2, 0.13, 0.08);
        
        // Directional light from the front-right (like a fireplace glow)
        const directionalLight = new BABYLON.DirectionalLight(
            'directionalLight', 
            new BABYLON.Vector3(0.5, -0.2, 1), // Light coming from front-right
            this.scene
        );
        directionalLight.intensity = 0.8;
        directionalLight.diffuse = new BABYLON.Color3(1.0, 0.9, 0.7); // Warm firelight
        
        // Add a soft amber rim light from left for cozy glow
        const rimLight = new BABYLON.DirectionalLight(
            'rimLight',
            new BABYLON.Vector3(-0.5, 0.2, -0.5),
            this.scene
        );
        rimLight.intensity = 0.4;
        rimLight.diffuse = new BABYLON.Color3(1.0, 0.6, 0.4); // Amber accent light
        
        // Point light to highlight the face - warm glow
        const faceLight = new BABYLON.PointLight(
            'faceLight', 
            new BABYLON.Vector3(0, 1.7, 1), 
            this.scene
        );
        faceLight.intensity = 0.5;
        faceLight.diffuse = new BABYLON.Color3(1.0, 0.9, 0.8);
        
        console.log('Cozy lighting setup completed');
    }

    setupCamera() {
        // Fixed camera position for front view of the avatar
        this.camera = new BABYLON.ArcRotateCamera(
            'camera',
            Math.PI, // alpha - directly in front (pi = 180 degrees around Y)
            Math.PI / 2.2, // beta - slightly above eye level
            3.5, // radius - zoom level
            new BABYLON.Vector3(0, 1.5, 0), // target position - focused on face
            this.scene
        );
        
        // Configure camera settings for portrait-style framing
        this.camera.fov = 0.45; // Slightly wider FOV for better framing
        this.camera.minZ = 0.1;
        this.camera.maxZ = 100;
        
        // Apply camera lock based on initial state
        this.setCameraLockState(this.cameraLocked);
        
        // Attach camera controls to canvas
        this.camera.attachControl(this.canvas, true);
        
        console.log('Camera setup with lock state:', this.cameraLocked);
    }
    
    // Camera lock functionality
    setCameraLockState(locked) {
        this.cameraLocked = locked;
        
        if (locked) {
            // Lock camera controls - no movement allowed
            this.camera.lowerRadiusLimit = this.camera.radius;
            this.camera.upperRadiusLimit = this.camera.radius;
            this.camera.lowerBetaLimit = this.camera.beta;
            this.camera.upperBetaLimit = this.camera.beta;
            this.camera.lowerAlphaLimit = this.camera.alpha;
            this.camera.upperAlphaLimit = this.camera.alpha;
            
            // Make sure we disable all camera controls
            this.camera.panningSensibility = 0;
            this.camera.wheelPrecision = 1000000; // Effectively disable zoom
            this.camera.pinchPrecision = 1000000; // Disable pinch zoom
        } else {
            // Unlock camera controls
            this.camera.lowerRadiusLimit = 2;
            this.camera.upperRadiusLimit = 10;
            this.camera.lowerBetaLimit = 0.1;
            this.camera.upperBetaLimit = Math.PI - 0.1;
            this.camera.lowerAlphaLimit = null;
            this.camera.upperAlphaLimit = null;
            
            // Enable camera controls
            this.camera.panningSensibility = 1000;
            this.camera.wheelPrecision = 50; // Enable zoom
            this.camera.pinchPrecision = 50; // Enable pinch zoom
        }
    }
    
    toggleCameraLock() {
        this.setCameraLockState(!this.cameraLocked);
        this.updateCameraLockIcon();
        return this.cameraLocked;
    }
    
    createCameraLockIcon() {
        const container = document.getElementById('avatar-canvas');
        if (!container) return;
        
        // Check if the icon already exists
        let iconContainer = document.getElementById('camera-lock-icon');
        if (iconContainer) {
            iconContainer.remove(); // Remove existing icon to avoid duplicates
        }
        
        // Create the icon container with cozy style to match the UI
        iconContainer = document.createElement('div');
        iconContainer.id = 'camera-lock-icon';
        iconContainer.style.position = 'absolute';
        iconContainer.style.bottom = '15px';
        iconContainer.style.right = '15px';
        iconContainer.style.padding = '8px';
        iconContainer.style.borderTop = '1px solid var(--accent-primary, #e08d60)';
        iconContainer.style.borderRight = '1px solid var(--accent-primary, #e08d60)';
        iconContainer.style.backgroundColor = 'rgba(42, 31, 29, 0.7)';
        iconContainer.style.backdropFilter = 'blur(5px)';
        iconContainer.style.display = 'flex';
        iconContainer.style.alignItems = 'center';
        iconContainer.style.justifyContent = 'center';
        iconContainer.style.cursor = 'pointer';
        iconContainer.style.zIndex = '10';
        iconContainer.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        iconContainer.style.boxShadow = 'var(--glow-shadow, 0 0 15px rgba(224, 141, 96, 0.4))';
        
        // Add the text label for better UX
        const label = document.createElement('span');
        label.style.color = 'var(--accent-primary, #e08d60)';
        label.style.textTransform = 'uppercase';
        label.style.fontSize = '10px';
        label.style.letterSpacing = '0.05em';
        label.style.marginRight = '6px';
        label.textContent = this.cameraLocked ? 'LOCKED' : 'FREE';
        iconContainer.appendChild(label);
        
        // Add the icon
        const icon = document.createElement('i');
        icon.id = 'camera-lock-icon-symbol';
        icon.className = this.cameraLocked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
        icon.style.color = 'var(--accent-primary, #e08d60)';
        icon.style.fontSize = '14px';
        iconContainer.appendChild(icon);
        
        // Add hover effect
        iconContainer.onmouseenter = () => {
            iconContainer.style.backgroundColor = 'rgba(54, 42, 38, 0.9)';
            iconContainer.style.boxShadow = '0 0 20px rgba(224, 141, 96, 0.6)';
        };
        
        iconContainer.onmouseleave = () => {
            iconContainer.style.backgroundColor = 'rgba(42, 31, 29, 0.7)';
            iconContainer.style.boxShadow = 'var(--glow-shadow, 0 0 15px rgba(224, 141, 96, 0.4))';
        };
        
        // Add click functionality
        iconContainer.onclick = () => {
            this.toggleCameraLock();
        };
        
        // Append to container
        container.appendChild(iconContainer);
    }
    
    updateCameraLockIcon() {
        const iconSymbol = document.getElementById('camera-lock-icon-symbol');
        const iconContainer = document.getElementById('camera-lock-icon');
        
        if (iconSymbol && iconContainer) {
            // Update icon class
            iconSymbol.className = this.cameraLocked ? 'fa-solid fa-lock' : 'fa-solid fa-lock-open';
            
            // Update label text
            const label = iconContainer.querySelector('span');
            if (label) {
                label.textContent = this.cameraLocked ? 'LOCKED' : 'FREE';
            }
            
            // Update border color based on state
            const borderColor = this.cameraLocked ? 
                'var(--accent-primary, #e08d60)' : 
                'var(--accent-secondary, #6a994e)';
            
            iconContainer.style.borderTop = `1px solid ${borderColor}`;
            iconContainer.style.borderRight = `1px solid ${borderColor}`;
            
            // Update icon color based on state
            iconSymbol.style.color = borderColor;
            if (label) {
                label.style.color = borderColor;
            }
        }
    }

    async loadAvatar() {
        const avatarModels = [
            "https://models.readyplayer.me/67f0ba1f74967f97e5557e40.glb", 
        
        ];
        
        let loadedSuccessfully = false;
        let lastError = null;
        
        for (let avatarUrl of avatarModels) {
            try {
                console.log(`Attempting to load avatar from ${avatarUrl}`);
                await Promise.race([
                    this._loadModel(avatarUrl),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Loading timeout')), 15000))
                ]);
                loadedSuccessfully = true;
                console.log("Avatar loaded successfully");
                break;
            } catch (error) {
                lastError = error;
                console.warn(`Failed to load avatar from ${avatarUrl}:`, error);
            }
        }
        
        if (!loadedSuccessfully) {
            try {
                console.log("Creating fallback avatar...");
                this._createFallbackAvatar();
                loadedSuccessfully = true;
                console.log("Fallback avatar created successfully");
            } catch (fallbackError) {
                console.error("Even fallback avatar failed:", fallbackError);
                throw lastError || new Error("Failed to load any avatar model");
            }
        }
    }

    // Create a cozy-styled fallback avatar
    _createFallbackAvatar() {
        // Create a simple sphere for head
        const head = BABYLON.MeshBuilder.CreateSphere("head", {diameter: 1.2}, this.scene);
        head.position = new BABYLON.Vector3(0, 1.6, 0);
        
        // Create material for the head - warmer skin tone
        const headMaterial = new BABYLON.StandardMaterial("headMaterial", this.scene);
        headMaterial.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.75);
        headMaterial.specularPower = 64;
        head.material = headMaterial;
        
        // Create eyes
        const eyeParams = {diameter: 0.2};
        const eyeMaterial = new BABYLON.StandardMaterial("eyeMaterial", this.scene);
        eyeMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1); // Warmer eye color
        
        const leftEye = BABYLON.MeshBuilder.CreateSphere("leftEye", eyeParams, this.scene);
        leftEye.position = new BABYLON.Vector3(-0.3, 1.7, 0.5);
        leftEye.material = eyeMaterial;
        
        const rightEye = BABYLON.MeshBuilder.CreateSphere("rightEye", eyeParams, this.scene);
        rightEye.position = new BABYLON.Vector3(0.3, 1.7, 0.5);
        rightEye.material = eyeMaterial;
        
        // Create mouth as a simple curved line
        const mouthMaterial = new BABYLON.StandardMaterial("mouthMaterial", this.scene);
        mouthMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.4, 0.3);
        
        const mouth = BABYLON.MeshBuilder.CreateTorus("mouth", {
            diameter: 0.5, 
            thickness: 0.05, 
            tessellation: 16
        }, this.scene);
        mouth.rotation.x = Math.PI / 2;
        mouth.rotation.z = Math.PI * 1.1; // Slight smile
        mouth.scaling.y = 0.5;
        mouth.position = new BABYLON.Vector3(0, 1.4, 0.5);
        mouth.material = mouthMaterial;
        
        // Group all parts
        this.avatar = new BABYLON.TransformNode("fallbackAvatar", this.scene);
        head.parent = this.avatar;
        leftEye.parent = this.avatar;
        rightEye.parent = this.avatar;
        mouth.parent = this.avatar;
        
        // Create simple animations
        this.animations["Idle"] = this._createFallbackAnimation("idle", mouth, false);
        this.animations["Talking"] = this._createFallbackAnimation("talking", mouth, true);
        
        // Play default animation
        this.playDefaultAnimation();
    }
    
    _createFallbackAnimation(name, mouthMesh, isTalking) {
        const frameRate = 10;
        const animationGroup = new BABYLON.AnimationGroup(name);
        
        // Create mouth animation
        const mouthAnimation = new BABYLON.Animation(
            `mouth_${name}`,
            "scaling.y",
            frameRate,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        let keys;
        if (isTalking) {
            // Talking animation: gentle mouth movement
            keys = [
                { frame: 0, value: 0.5 },
                { frame: frameRate/4, value: 0.7 },
                { frame: frameRate/2, value: 0.4 },
                { frame: 3*frameRate/4, value: 0.6 },
                { frame: frameRate, value: 0.5 }
            ];
        } else {
            // Idle animation: very slight movement
            keys = [
                { frame: 0, value: 0.5 },
                { frame: frameRate/2, value: 0.52 },
                { frame: frameRate, value: 0.5 }
            ];
        }
        
        mouthAnimation.setKeys(keys);
        
        // Add the animation to the animation group
        animationGroup.addTargetedAnimation(mouthAnimation, mouthMesh);
        
        return animationGroup;
    }

    _loadModel(avatarUrl) {
        return new Promise((resolve, reject) => {
            // Add a loading indicator
            const loadingSphere = BABYLON.MeshBuilder.CreateSphere("loadingSphere", {diameter: 0.5}, this.scene);
            loadingSphere.position = new BABYLON.Vector3(0, 1, 0);
            
            // Warm amber loading indicator
            const loadingMaterial = new BABYLON.StandardMaterial("loadingMaterial", this.scene);
            loadingMaterial.diffuseColor = new BABYLON.Color3(0.9, 0.6, 0.3);
            loadingMaterial.emissiveColor = new BABYLON.Color3(0.6, 0.3, 0.1);
            loadingSphere.material = loadingMaterial;
            
            // Animation for the loading indicator
            const anim = new BABYLON.Animation(
                "loadingAnimation", 
                "scaling", 
                30, 
                BABYLON.Animation.ANIMATIONTYPE_VECTOR3, 
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            );
            
            const keys = [
                { frame: 0, value: new BABYLON.Vector3(1, 1, 1) },
                { frame: 15, value: new BABYLON.Vector3(1.3, 1.3, 1.3) },
                { frame: 30, value: new BABYLON.Vector3(1, 1, 1) }
            ];
            
            anim.setKeys(keys);
            loadingSphere.animations.push(anim);
            this.scene.beginAnimation(loadingSphere, 0, 30, true);
            
            BABYLON.SceneLoader.ImportMesh(
                "", 
                avatarUrl, 
                "", 
                this.scene, 
                (meshes, particleSystems, skeletons, animationGroups) => {
                    try {
                        // Remove loading indicator
                        loadingSphere.dispose();
                        
                        if (!meshes || meshes.length === 0) {
                            throw new Error('No meshes loaded');
                        }
                        
                        this.avatar = meshes[0];
                        console.log(`Loaded ${meshes.length} meshes`);
                        
                        // Position and rotation adjustments
                        this.avatar.position = new BABYLON.Vector3(0, 0, 0);
                        
                        // Adjust based on model type
                        if (avatarUrl.includes('readyplayer.me') || avatarUrl.includes('cloudfront.net')) {
                            this.avatar.rotation = new BABYLON.Vector3(0, 0, 0);
                            this.avatar.position.y = -0.5;
                        } else if (avatarUrl.includes('HVGirl')) {
                            this.avatar.rotation = new BABYLON.Vector3(0, Math.PI, 0);
                            this.avatar.position.y = -0.6;
                        } else {
                            this.avatar.rotation = new BABYLON.Vector3(0, 0, 0);
                            this.avatar.position.y = -0.5;
                        }
                        
                        // Scale the avatar appropriately
                        this.uniformScaleAvatar();
                        
                        // Store animation groups
                        if (animationGroups && animationGroups.length > 0) {
                            animationGroups.forEach(animGroup => {
                                animGroup.stop();
                                this.animations[animGroup.name] = animGroup;
                            });
                            
                            // Play default animation
                            this.playDefaultAnimation();
                        } else {
                            console.warn("No animations found in the model");
                            this._createDefaultAnimations();
                        }
                        
                        // Apply post-processing
                        this.applyCozyPostProcessing();
                        
                        resolve();
                    } catch (error) {
                        if (loadingSphere) {
                            loadingSphere.dispose();
                        }
                        console.error("Error processing imported mesh:", error);
                        reject(error);
                    }
                },
                null,
                (scene, message, exception) => {
                    if (loadingSphere) {
                        loadingSphere.dispose();
                    }
                    console.error("Import mesh error:", message);
                    reject(new Error(message));
                }
            );
        });
    }
    
    // Create simple animations for models without them
    _createDefaultAnimations() {
        if (!this.avatar) return;
        
        const idleAnimGroup = new BABYLON.AnimationGroup("Idle");
        const talkingAnimGroup = new BABYLON.AnimationGroup("Talking");
        
        // Find a head mesh if possible
        const headMesh = this.avatar.getChildMeshes().find(m => 
            m.name.toLowerCase().includes('head') || 
            m.name.toLowerCase().includes('neck')
        );
        
        if (headMesh) {
            // Create idle animation - subtle head movements
            const idleAnim = new BABYLON.Animation(
                "idleHeadAnim", 
                "rotation.y", 
                10, 
                BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            );
            
            const idleKeys = [
                { frame: 0, value: -0.02 },
                { frame: 30, value: 0.02 },
                { frame: 60, value: -0.02 }
            ];
            
            idleAnim.setKeys(idleKeys);
            idleAnimGroup.addTargetedAnimation(idleAnim, headMesh);
            
            // Create talking animation - gentle head movements
            const talkAnim = new BABYLON.Animation(
                "talkHeadAnim", 
                "rotation.y", 
                15, 
                BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            );
            
            const talkKeys = [
                { frame: 0, value: -0.05 },
                { frame: 5, value: 0 },
                { frame: 10, value: 0.05 },
                { frame: 15, value: 0 },
                { frame: 20, value: -0.05 }
            ];
            
            talkAnim.setKeys(talkKeys);
            talkingAnimGroup.addTargetedAnimation(talkAnim, headMesh);
        } else {
            // Animate the whole avatar with subtle movements if no head found
            const idleAnim = new BABYLON.Animation(
                "idleAnim", 
                "rotation.y", 
                10, 
                BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            );
            
            const idleKeys = [
                { frame: 0, value: -0.01 },
                { frame: 30, value: 0.01 },
                { frame: 60, value: -0.01 }
            ];
            
            idleAnim.setKeys(idleKeys);
            idleAnimGroup.addTargetedAnimation(idleAnim, this.avatar);
            
            // Talking animation - slightly more movement
            const talkAnim = new BABYLON.Animation(
                "talkAnim", 
                "rotation.y", 
                10, 
                BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
            );
            
            const talkKeys = [
                { frame: 0, value: -0.02 },
                { frame: 10, value: 0.02 },
                { frame: 20, value: -0.02 }
            ];
            
            talkAnim.setKeys(talkKeys);
            talkingAnimGroup.addTargetedAnimation(talkAnim, this.avatar);
        }
        
        // Store animations
        this.animations["Idle"] = idleAnimGroup;
        this.animations["Talking"] = talkingAnimGroup;
    }
    
    uniformScaleAvatar() {
        if (!this.avatar) return;
        
        // Calculate ideal scale
        const boundingInfo = this.avatar.getHierarchyBoundingVectors();
        const size = boundingInfo.max.subtract(boundingInfo.min);
        
        const idealHeight = 2.8;
        const currentHeight = size.y;
        const scale = idealHeight / currentHeight;
        
        // Apply uniform scaling
        this.avatar.scaling = new BABYLON.Vector3(scale, scale, scale);
    }

    applyCozyPostProcessing() {
        // Create default pipeline
        const pipeline = new BABYLON.DefaultRenderingPipeline(
            "defaultPipeline", 
            true, 
            this.scene, 
            [this.camera]
        );
        
        // Enable anti-aliasing
        pipeline.samples = 4;
        
        // Subtle depth of field
        pipeline.depthOfFieldEnabled = true;
        pipeline.depthOfField.focalLength = 150;
        pipeline.depthOfField.fStop = 1.4;
        pipeline.depthOfField.focusDistance = 2500;
        
        // Warm image processing
        pipeline.imageProcessingEnabled = true;
        pipeline.imageProcessing.contrast = 1.1;
        pipeline.imageProcessing.exposure = 1.0;
        
        // Warm color tone mapping
        pipeline.imageProcessingEnabled = true;
        pipeline.imageProcessing.toneMappingEnabled = true;
        pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        
        // Subtle vignette for cozy effect
        pipeline.imageProcessing.vignetteEnabled = true;
        pipeline.imageProcessing.vignetteWeight = 0.5;
        pipeline.imageProcessing.vignetteCentreX = 0;
        pipeline.imageProcessing.vignetteCentreY = 0;
        pipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0.2, 0.12, 0.08, 0);
    }

    playDefaultAnimation() {
        // Find a suitable idle animation
        const idleOptions = ['Idle', 'idle', 'Default', 'default', 'Stand', 'stand'];
        
        for (const option of idleOptions) {
            if (this.animations[option]) {
                this.playAnimation(option);
                return;
            }
        }
        
        // If no specific idle animation found, play the first available animation
        const firstAnim = Object.keys(this.animations)[0];
        if (firstAnim) {
            this.playAnimation(firstAnim);
        }
    }

    playAnimation(name) {
        // Stop current animation if any
        if (this.currentAnimation) {
            this.currentAnimation.stop();
        }
        
        // Play the requested animation if it exists
        if (this.animations[name]) {
            this.animations[name].start(true, 1.0, this.animations[name].from, this.animations[name].to, false);
            this.currentAnimation = this.animations[name];
            return true;
        } else {
            console.warn(`Animation "${name}" not found`);
            return false;
        }
    }

    startTalking() {
        if (this.isTalking) return;
        
        this.isTalking = true;
        
        // Find a talking animation
        const talkOptions = [
            'Talk', 'Talking', 'talk', 'talking', 
            'Speak', 'speak', 'Speaking', 'speaking'
        ];
        
        let foundTalkingAnimation = false;
        
        for (const option of talkOptions) {
            if (this.animations[option]) {
                this.playAnimation(option);
                foundTalkingAnimation = true;
                break;
            }
        }
        
        // If no talking animation found, simulate simple talking
        if (!foundTalkingAnimation && this.avatar) {
            this._simulateSimpleTalking();
        }
        
        // Update status indicator
        const statusDot = document.querySelector('.status-dot');
        if (statusDot) {
            statusDot.classList.add('speaking');
        }
        
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = 'SPEAKING...';
        }
    }
    
    _simulateSimpleTalking() {
        // Find the head or avatar root
        const target = this.avatar.getChildMeshes().find(m => 
            m.name.toLowerCase().includes('head')
        ) || this.avatar;
        
        // Create simple animation
        const animation = new BABYLON.Animation(
            "simpleTalking", 
            "rotation.y", 
            10, 
            BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        const startValue = target.rotation.y;
        const keys = [
            { frame: 0, value: startValue - 0.03 },
            { frame: 5, value: startValue + 0.02 },
            { frame: 10, value: startValue - 0.03 }
        ];
        
        animation.setKeys(keys);
        target.animations = [animation];
        
        // Start the animation
        this._talkingAnimation = this.scene.beginAnimation(target, 0, 10, true);
    }

    stopTalking() {
        if (!this.isTalking) return;
        
        this.isTalking = false;
        
        // Stop talking simulation if it exists
        if (this._talkingAnimation) {
            this._talkingAnimation.stop();
            this._talkingAnimation = null;
        }
        
        // Return to default animation
        this.playDefaultAnimation();
        
        // Update status indicator
        const statusDot = document.querySelector('.status-dot');
        if (statusDot) {
            statusDot.classList.remove('speaking');
        }
        
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = 'ONLINE';
        }
    }

    setupResizeListener() {
        window.addEventListener('resize', () => {
            if (this.engine) {
                this.engine.resize();
            }
        });
    }

    startRenderLoop() {
        // Make sure we have all the required components
        if (!this.engine || !this.scene) {
            console.error("Cannot start render loop: engine or scene is missing");
            return;
        }
        
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    showErrorMessage() {
        const container = document.getElementById('avatar-canvas');
        if (container) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-primary); text-align: center; padding: 20px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 1rem; color: var(--accent-primary);"></i>
                    <p style="margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">CONNECTION LOST</p>
                    <button id="retry-avatar" style="padding: 8px 16px; background: none; border: 1px solid var(--accent-primary); color: var(--accent-primary); cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;">
                        RECONNECT
                    </button>
                </div>
            `;
            
            // Add retry button functionality
            const retryButton = document.getElementById('retry-avatar');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    container.innerHTML = '';
                    this.init();
                });
            }
        }
    }
}

// Initialize avatar when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Show loading indicator while avatar initializes
    const container = document.getElementById('avatar-canvas');
    if (container) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-primary); text-align: center; padding: 20px;">
                <div style="margin-bottom: 1rem;">
                    <div class="loading-dots">
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                    </div>
                </div>
                <p style="text-transform: uppercase; letter-spacing: 0.05em;">CONNECTING...</p>
            </div>
        `;
    }
    
    // Initialize avatar manager
    setTimeout(() => {
        try {
            console.log('Initializing avatar manager');
            window.avatarManager = new AvatarManager();
            window.avatarManager.init().catch(error => {
                console.error("Avatar initialization error:", error);
            });
            
            // Define function to control avatar speaking state
            window.updateAvatarSpeakingState = function(isSpeaking) {
                if (window.avatarManager) {
                    if (isSpeaking) {
                        window.avatarManager.startTalking();
                    } else {
                        window.avatarManager.stopTalking();
                    }
                }
            };
        } catch (error) {
            console.error("Error setting up avatar:", error);
        }
    }, 500);
});
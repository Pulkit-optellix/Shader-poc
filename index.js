import * as THREE from 'three';

import { GUI } from 'dat.gui'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Mesh } from 'three';

let activeCamera, camera, scene, renderer, controls, shaderMaterial, orthoCamera, light;
let supportsExtension = true;
let textures = [];


const params = {
    format: THREE.DepthFormat,
    type: THREE.UnsignedShortType
};


const n = 1;
function makeSwitchCase(i) {
    return `
                    case ${i}:
                        a += texture2D(tDepth[${i}], vUv);
                        break;
                    `
};

const fragShader = `
#include <packing>
        const int n =${n};
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth[n];
        uniform float cameraNear;
        uniform float cameraFar;


        float readDepth( sampler2D depthSampler, vec2 coord ) {
            float fragCoordZ = texture2D( depthSampler, coord ).x;
            float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
            return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
        }

        vec4 averageTextures(sampler2D textures[n], vec2 coord){
            vec4 a = texture2D(tDepth[0], coord);
            for (int i = 1; i < n; i++) {
                switch(i) {
                    // we are not allowed to use i as index to access texture in array in current version of GLSL
                    ${new Array(n)
        .fill(0)
        .map((_, i) => makeSwitchCase(i))
        .join('')}
                    default: break;
                  }
            }
            return a/${n + '.0'};
        }
        void main() {
            //vec3 diffuse = texture2D( tDiffuse, vUv ).rgb;
            //float depth1 = readDepth( tDepth[0], vUv );
            //float depth2 = readDepth( tDepth[1], vUv );

            gl_FragColor = averageTextures(tDepth, vUv);
            //gl_FragColor.rgb = vec3(1.0);
            //gl_FragColor.a = 1.0;
        }`


init();
initGUI();
animate();



function init() {
    renderer = new THREE.WebGLRenderer();
    if (renderer.capabilities.isWebGL2 === false && renderer.extensions.has('WEBGL_depth_texture') === false) {

        supportsExtension = false;
        document.querySelector('#error').style.display = 'block';
        return;

    }
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    setupScene();
    onWindowResize();
    window.addEventListener('resize', onWindowResize);
}

function initGUI() {
    var gui = new GUI();
    gui.add(camera, 'visible', true);
    const lightFolder = gui.addFolder('Light')
    lightFolder.add(light.position, 'x', -10, 10)
    lightFolder.add(light.position, 'y',-10, 10)
    lightFolder.add(light.position, 'z', -10, 10)
    lightFolder.open()
}


function setupScene() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
    camera.position.z = 4;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    activeCamera = camera;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    setupOrtho();

    shaderMaterial = new THREE.ShaderMaterial({
        vertexShader: document.querySelector('#post-vert').textContent.trim(),
        fragmentShader: fragShader,
        uniforms: {
            cameraNear: { value: light.shadow.camera.near },
            cameraFar: { value: light.shadow.camera.far },
            tDiffuse: { value: null },
            tDepth: { value: textures }
        },
        side: THREE.DoubleSide
    });



    const roofGeo = new THREE.PlaneGeometry(10, 10, 10);
    const obsGeo = new THREE.PlaneGeometry(5, 5, 5);
    const blueMaterial = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide })
    const roof = new Mesh(roofGeo, blueMaterial)
    const obstacle = new Mesh(obsGeo, blueMaterial)

    obstacle.position.set(0, 0, 5)

    scene.add(roof)
    scene.add(obstacle)
    light.target = obstacle;
    light.shadow.camera.target = obstacle;
    getDepthTexture();

    roof.material = shaderMaterial;
}


function setupOrtho() {
    light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(0, 10, 10);
    const sphere = new Mesh(new THREE.SphereGeometry(0.2, 32, 32), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide }));
    scene.add(light);
    light.add(sphere);
    light.shadow.camera = new THREE.OrthographicCamera(- 10, 10, 10, -10, 0, 10);
    light.add(light.shadow.camera);
}

function onWindowResize() {

    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function getDepthTexture() {
    let target;
    function setupRenderTarget() {

        if (target) target.dispose();

        const format = parseFloat(params.format);
        const type = parseFloat(params.type);

        target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        target.texture.minFilter = THREE.NearestFilter;
        target.texture.magFilter = THREE.NearestFilter;
        target.stencilBuffer = false;
        target.depthTexture = new THREE.DepthTexture();
        target.depthTexture.format = format;
        target.depthTexture.type = type;

        light.shadow.map = target;
    }
    setupRenderTarget();

    renderer.setRenderTarget(light.shadow.map);
    renderer.render(scene, light.shadow.camera);
    
    textures.push(new THREE.Texture().copy(target.depthTexture));
    renderer.setRenderTarget(null);
}

function toogleCamera() {
    if (activeCamera === camera) {
        activeCamera = light.shadow.camera
    }
    else {
        activeCamera = camera
    }
}

function animate() {
    if (camera.visible) {
        activeCamera = camera;
    } else {
        activeCamera = light.shadow.camera;
    }

    if (!supportsExtension) return;
    requestAnimationFrame(animate);
    renderer.render(scene, activeCamera);
    controls.update();
}


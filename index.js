import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Mesh } from 'three';

let camera, scene, renderer, controls, shaderMaterial, orthoCamera;
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
            return a/${n+'.0'};
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

function setupScene() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
    camera.position.z = 4;
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    setupOrtho();
    
    shaderMaterial = new THREE.ShaderMaterial({
        vertexShader: document.querySelector('#post-vert').textContent.trim(),
        fragmentShader: fragShader,
        uniforms: {
            cameraNear: { value: orthoCamera.near },
            cameraFar: { value: orthoCamera.far },
            tDiffuse: { value: null },
            tDepth: { value: textures }
        },
        side: THREE.DoubleSide
    });



    const roofGeo = new THREE.PlaneGeometry(10, 10, 10);
    const obsGeo = new THREE.PlaneGeometry(5, 5, 5);
    const blueMaterial = new THREE.MeshBasicMaterial({ color: 'blue' });
    const roof = new Mesh(roofGeo, blueMaterial)
    const obstacle = new Mesh(obsGeo, blueMaterial)

    obstacle.position.set(0,0,5)

    scene.add(roof)
    scene.add(obstacle)

    getDepthTexture();

    roof.material = shaderMaterial;
}

function setupOrtho(){
    orthoCamera = new THREE.OrthographicCamera(- 10, 10, 10, -10, 0, 10);
    orthoCamera.position.set(0, 0, 10);
    orthoCamera.lookAt(0, 0, 0);
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

        target = new THREE.WebGLRenderTarget(512, 512);
        target.texture.minFilter = THREE.NearestFilter;
        target.texture.magFilter = THREE.NearestFilter;
        target.stencilBuffer = false;
        target.depthTexture = new THREE.DepthTexture();
        target.depthTexture.format = format;
        target.depthTexture.type = type;

    }
    setupRenderTarget();

    renderer.setRenderTarget(target);
    renderer.render(scene, orthoCamera);
    textures.push(new THREE.Texture().copy(target.depthTexture));
    renderer.setRenderTarget(null);
}

function animate() {

    if (!supportsExtension) return;
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
}


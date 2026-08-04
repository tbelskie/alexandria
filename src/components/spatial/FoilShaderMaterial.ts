import * as THREE from 'three'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import type { JSX, Ref } from 'react'

/**
 * Metallic foil stamping over leather/cloth — specular reacts to view/light.
 * uFoilMask.r = foil coverage; g = emboss depth hint.
 */
export const FoilShaderMaterial = shaderMaterial(
  {
    uBaseColor: new THREE.Color('#3A1316'),
    uFoilColor: new THREE.Color('#D4AF37'),
    uFoilSpecular: new THREE.Color('#FFF3A8'),
    uEmbossShadow: new THREE.Color('#5A4810'),
    uLeatherMap: null as THREE.Texture | null,
    uFoilMask: null as THREE.Texture | null,
    uNormalMap: null as THREE.Texture | null,
    uLightDirection: new THREE.Vector3(0.55, 0.85, 0.65),
    uGloss: 42.0,
    uTime: 0,
  },
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uFoilColor;
    uniform vec3 uFoilSpecular;
    uniform vec3 uEmbossShadow;
    uniform sampler2D uLeatherMap;
    uniform sampler2D uFoilMask;
    uniform sampler2D uNormalMap;
    uniform vec3 uLightDirection;
    uniform float uGloss;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldNormal;

    void main() {
      vec3 leather = texture2D(uLeatherMap, vUv * 2.4).rgb;
      vec4 maskSample = texture2D(uFoilMask, vUv);
      float foilMask = maskSample.r;
      float emboss = maskSample.g;

      // Perturb normal slightly from emboss + normal map
      vec3 mapN = texture2D(uNormalMap, vUv * 3.0).xyz * 2.0 - 1.0;
      vec3 normal = normalize(vNormal + mapN * 0.18 + vec3(0.0, 0.0, emboss * 0.35));

      vec3 viewDir = normalize(vViewPosition);
      vec3 lightDir = normalize(uLightDirection);
      // Slow shimmer so foil feels alive under studio light
      lightDir = normalize(lightDir + vec3(sin(uTime * 0.35) * 0.08, 0.0, cos(uTime * 0.28) * 0.06));
      vec3 halfDir = normalize(lightDir + viewDir);

      float ndl = max(dot(normal, lightDir), 0.0);
      float spec = pow(max(dot(normal, halfDir), 0.0), uGloss);
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

      vec3 base = uBaseColor * leather;
      base *= 0.55 + ndl * 0.55;
      // Deboss caves into leather
      base = mix(base, base * 0.55 * uEmbossShadow / max(length(uEmbossShadow), 0.001), emboss * (1.0 - foilMask) * 0.65);

      vec3 foil = mix(uFoilColor, uFoilSpecular, spec * 0.85 + fresnel * 0.35);
      foil += spec * uFoilSpecular * 0.9;
      foil *= 0.65 + ndl * 0.5;

      vec3 color = mix(base, foil, smoothstep(0.12, 0.55, foilMask));
      // Soft contact AO near edges of mask
      color *= 1.0 - (1.0 - foilMask) * emboss * 0.15;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
)

extend({ FoilShaderMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    foilShaderMaterial: JSX.IntrinsicElements['shaderMaterial'] & {
      ref?: Ref<THREE.ShaderMaterial>
      uBaseColor?: THREE.Color | string
      uFoilColor?: THREE.Color | string
      uFoilSpecular?: THREE.Color | string
      uEmbossShadow?: THREE.Color | string
      uLeatherMap?: THREE.Texture | null
      uFoilMask?: THREE.Texture | null
      uNormalMap?: THREE.Texture | null
      uLightDirection?: THREE.Vector3
      uGloss?: number
      uTime?: number
    }
  }
}

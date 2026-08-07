/**
 * Type declarations for React Three Fiber extensions.
 * Allows JSX usage of <instanceColor> which is registered
 * at runtime via R3F's extend() function.
 */

import { InstancedBufferAttribute } from "three";
import "react";

declare module "@react-three/fiber" {
  interface ThreeElements {
    instanceColor: {
      args?: [InstancedBufferAttribute, number];
      attach?: string;
      [key: string]: any;
    };
  }
}

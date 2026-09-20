import React from "react";
import { registerRootComponent } from "expo";
import App from "./App.tsx";
import { installSecureRandom } from "./src/storage/random.ts";

installSecureRandom();

registerRootComponent(() => React.createElement(App));

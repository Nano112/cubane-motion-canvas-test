import { defineConfig } from "vite";
import motionCanvas from "@motion-canvas/vite-plugin";
import ffmpeg from "@motion-canvas/ffmpeg";

export default defineConfig({
	server: {
		port: 3123,
	},
	plugins: [motionCanvas(), ffmpeg()],
});

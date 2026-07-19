import "./index.css";
import { Composition } from "remotion";
import { SerenoVideo } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Sereno"
      component={SerenoVideo}
      durationInFrames={2700}
      fps={30}
      width={1280}
      height={720}
    />
  );
};

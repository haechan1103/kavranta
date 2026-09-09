import { useEffect, useRef, useState } from "react";
import {
  projectDemoFrame,
  scenes,
  SCENE_DURATION_MS,
  type DemoScene,
} from "./demoStory";

const TICK_MS = 50;
const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Owns browser timing and lifecycle; the story and rendering are independent. */
export function useDemoPlayback(stories: readonly DemoScene[] = scenes) {
  const [timeline, setTimeline] = useState(() => ({
    sceneIndex: 0,
    elapsed: reducedMotion() ? SCENE_DURATION_MS - 1 : 0,
  }));
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [inView, setInView] = useState(false);
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.1 },
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      if (!preference.matches) return;
      setPlaying(false);
      setTimeline((current) => ({
        ...current,
        elapsed: SCENE_DURATION_MS - 1,
      }));
    };
    preference.addEventListener("change", handleChange);
    return () => preference.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setTimeline((current) => {
        const elapsed = current.elapsed + TICK_MS;
        return elapsed >= SCENE_DURATION_MS
          ? {
              sceneIndex: (current.sceneIndex + 1) % stories.length,
              elapsed: 0,
            }
          : { ...current, elapsed };
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing, inView, stories.length]);

  const selectScene = (index: number) => {
    if (!stories[index]) return;
    setTimeline({
      sceneIndex: index,
      elapsed: reducedMotion() || !playing ? SCENE_DURATION_MS - 1 : 0,
    });
  };
  const replay = () => {
    setTimeline({ sceneIndex: 0, elapsed: 0 });
    setPlaying(true);
  };

  return {
    ...timeline,
    ...projectDemoFrame(timeline.sceneIndex, timeline.elapsed, stories),
    container,
    playing,
    selectScene,
    replay,
    togglePlayback: () => setPlaying((current) => !current),
  };
}

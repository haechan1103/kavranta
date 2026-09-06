// Illustrative metadata only. Local and Development are file display aliases.
export const scenes = [
  {
    label: "변수 설정",
    title: "한 문장으로, 설정 끝.",
    description:
      "빈 변수를 추가하고 새 비밀값을 생성해 저장합니다. 값은 대화에 나타나지 않습니다.",
    prompt:
      "Local 파일에 AUTH_SECRET을 추가하고, 안전한 임의 값으로 채워줘. 값은 보여주지 마.",
    lines: [
      "등록된 sample-app 확인",
      "AUTH_SECRET 빈 변수 추가",
      "일회용 계획으로 생성값 저장",
      "완료 · 1개 파일 변경 · 값 비노출",
    ],
  },
  {
    label: "파일 연결",
    title: "같이 쓰는 값은, 같이 관리.",
    description:
      "함께 쓸 변수만 직접 연결합니다. 어느 멤버에서 수정해도 연결된 모든 파일에 반영됩니다.",
    prompt:
      "AUTH_SECRET을 Local과 Development 파일에서 연결해줘. Local 값을 기준으로 해줘.",
    lines: [
      "같은 이름의 변수 2개 확인",
      "기준 파일 · Local",
      "영향 범위 · 2개 파일",
      "완료 · 2개 파일 연결 · 보호 정책 유지",
    ],
  },
  {
    label: "GitHub 배포",
    title: "선택한 곳까지, 비밀 그대로.",
    description:
      "소스와 목적지를 지정하면 선택한 값만 전송합니다. AI에는 전송 결과만 돌아옵니다.",
    prompt:
      "Local 파일의 AUTH_SECRET을 demo/sample-app 저장소의 staging Environment에 GitHub Secret으로 올려줘.",
    lines: [
      "GitHub 로그인 및 대상 접근 확인",
      "목적지 · demo/sample-app / staging",
      "AUTH_SECRET 전송 중 · 값 비노출",
      "완료 · Secret 1개 전송 · 실패 0개",
    ],
  },
] as const;

export const SCENE_DURATION_MS = 10500;
export const TYPE_START_MS = 450;
export const TYPE_DURATION_MS = 2800;
export const RESULT_START_MS = 3800;
export const RESULT_INTERVAL_MS = 1000;
export type DemoFrame = ReturnType<typeof projectDemoFrame>;

/** Pure presentation state for the fictional story, not environment domain logic. */
export function projectDemoFrame(sceneIndex: number, elapsed: number) {
  const scene = scenes[sceneIndex] ?? scenes[0];
  const typedCount = Math.floor(
    Math.max(0, Math.min(1, (elapsed - TYPE_START_MS) / TYPE_DURATION_MS)) *
      scene.prompt.length,
  );
  const visibleLines = Math.max(
    0,
    Math.min(
      scene.lines.length,
      Math.floor((elapsed - RESULT_START_MS) / RESULT_INTERVAL_MS) + 1,
    ),
  );
  const complete = visibleLines === scene.lines.length;
  return {
    scene,
    typedCount,
    visibleLines,
    complete,
    hasVariable: sceneIndex > 0 || visibleLines >= 2,
    hasValue: sceneIndex > 0 || visibleLines >= 3,
    linked: sceneIndex > 1 || (sceneIndex === 1 && complete),
    deployed: sceneIndex === 2 && complete,
  };
}

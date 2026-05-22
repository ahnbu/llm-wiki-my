# LLM Wiki My 사용자 가이드

이 문서는 Codex에서 LLM Wiki My를 사용할 때의 기능별 요청 방식과 운영 흐름을 정리한다. 핵심은 wiki를 단순 검색창이 아니라, 원천자료를 보존하고 article로 합성한 뒤 반복 재사용하는 지식 작업공간으로 쓰는 것이다.

## 한 줄 요약

Codex의 LLM Wiki My는 `@wiki <workflow>` 자연어 요청으로 사용한다. 기본 정비 흐름은 `ingest` -> `compile` -> `lint`이고, 이후 목적에 따라 `query`, `research`, `plan`, `output`, `audit`을 요청한다.

```markdown
@wiki query 문제정의와 가설검증은 이 위키에서 어떻게 정리되어 있는가?
```

```markdown
@wiki output 문제정의와 가설검증 article을 바탕으로 강의용 1페이지 핸드아웃을 만들어줘.
```

## 기본 개념

LLM Wiki My는 세 층으로 생각하면 쉽다.

- `raw/`: 원천자료를 보존하는 곳. ingest 이후에는 원문을 임의 수정하지 않는다.
- `wiki/`: raw를 바탕으로 합성한 concept, topic, reference article.
- `output/`: 위키 내용을 바탕으로 만든 보고서, 가이드, 핸드아웃, 계획서 같은 산출물.

`query`는 보통 대화창에 답변만 반환한다. 저장되는 문서를 만들려면 `output`을 요청해야 한다.

## 시작 전 확인

먼저 어느 wiki를 대상으로 작업할지 분명히 한다. 현재 프로젝트에 `.wiki/`가 있으면 보통 그 로컬 wiki가 대상이다. 프로젝트와 무관한 장기 지식은 hub의 topic wiki를 대상으로 삼는다.

```markdown
@wiki 현재 프로젝트의 로컬 wiki 상태를 확인해줘.
```

새 topic wiki가 필요하면 `init` 성격의 요청을 한다.

```markdown
@wiki 새 topic wiki를 만들어줘. 이름은 ai-planning-course이고, 목적은 AI 활용 강의 자료 정리야.
```

작업 대상이 애매하면 먼저 상태 확인이나 대상 지정부터 한다. 잘못된 wiki에 ingest하면 이후 compile, query, output이 모두 엉뚱한 맥락을 보게 된다.

## 기본 정비 흐름

### 1. ingest

외부 자료, 로컬 파일, 메모, URL을 wiki의 `raw/`에 보존한다. 아직 지식 article이 된 것은 아니며, 원천자료를 wiki가 다시 읽을 수 있는 형태로 넣는 단계다.

```markdown
@wiki ingest 이 파일을 현재 로컬 wiki의 raw source로 넣어줘.
```

자료가 여러 개이거나 출처 묶음이면 `ingest-collection` 성격으로 요청한다.

```markdown
@wiki ingest-collection 이 폴더의 강의 참고자료를 원천자료 묶음으로 수집해줘.
```

### 2. compile

`raw/`에 들어간 자료를 읽고, 재사용 가능한 `wiki/` article로 합성한다. 단순 요약이 아니라 여러 원천자료를 연결해 개념, 주제, 참조 지도로 만든다.

```markdown
@wiki compile 새로 ingest된 자료를 문제정의, 가설검증, AI 협업 관점의 article로 합성해줘.
```

기본은 incremental compile이다. 즉, 새로 들어온 source를 중심으로 처리한다.

### 3. lint

wiki 구조, frontmatter, index, link, source provenance를 점검한다. ingest나 compile 뒤에는 lint를 요청해 구조를 안정화하는 편이 좋다.

```markdown
@wiki lint 현재 로컬 wiki 구조를 점검해줘.
```

```markdown
@wiki lint 구조상 자동 보정 가능한 문제는 고쳐줘.
```

## 활용 흐름

### query

위키에 이미 정리된 내용을 조회하고 답변을 받는다. 기본적으로 문서를 생성하지 않는다.

좋은 query는 자연어로 하되, 질문 안에 정확한 anchor term을 넣는다.

```markdown
[개념명] + [사용 목적] + [원하는 답변 형태]
```

예시:

```markdown
@wiki query 문제정의와 가설검증을 신입 대상 AI 활용 강의에서 설명하려고 한다.
핵심 개념, 근거 article, 실습 전환 포인트를 정리해줘.
```

```markdown
@wiki query 문제정의, 가설수립, AI 프롬프트 활용을 연결해서
수강생이 문제를 질문으로 바꾸고, 질문을 검증 가능한 가설로 바꾸는 흐름을 설명해줘.
```

답변이 약하면 질문을 길게 만들기보다 먼저 확인할 것이 있다.

- 관련 개념 article이 있는가?
- raw source는 ingest되어 있는가?
- ingest만 되어 있고 compile이 안 된 상태인가?
- 필요한 경우 `research`나 추가 ingest가 필요한가?

### research

위키에 없는 내용을 외부에서 추가 조사해 보강한다. 일반 딥리서치와 달리 목표는 보고서 한 번 만들기가 아니라, 좋은 source를 찾아 `raw/`에 넣고 wiki article로 이어지게 하는 것이다.

```markdown
@wiki research AI 시대 신입에게 필요한 문제정의 역량을 보강 조사해줘.
현재 wiki에 있는 내용과 겹치지 않는 근거 중심으로 찾아줘.
```

`research`는 현재 위키 상태를 먼저 확인하고, 검색 경로를 나누고, 출처 품질을 평가하고, 필요한 source를 ingest한 뒤 compile까지 이어질 수 있다. 작업 뒤에는 `lint`로 구조를 점검하는 편이 안전하다.

`@wiki research`가 하도록 설계된 흐름은 다음에 가깝다.

1. 현재 위키 상태를 먼저 읽는다.
2. 주제를 여러 관점이나 질문으로 쪼갠다.
3. 각 경로에서 웹 검색과 본문 확인을 수행한다.
4. 출처별 품질을 평가한다.
5. 쓸 만한 자료를 `raw/`에 ingest한다.
6. ingest된 자료를 `wiki/` article로 compile한다.
7. 세션 로그와 체크포인트를 남겨 중단 후 재개 가능하게 한다.
8. 필요하면 이후 `lint`로 구조, frontmatter, index를 검수한다.

계획형 research 요청을 하면 주제를 몇 개의 독립 경로로 나눠 병렬 조사할 수 있다. 이때 병렬 ingest는 비교적 안전하지만, compile은 article과 index 충돌 위험이 있어 자료 수집 후 단일 흐름으로 합치는 것이 원칙이다.

일반 딥리서치와의 차이는 다음과 같다.

- 일반 딥리서치: 답변이나 보고서를 만들기 위한 일회성 조사.
- `@wiki research`: source 보존, article 합성, 이후 query/output/audit 재사용을 위한 위키 보강.
- 일반 딥리서치는 답변 안에 출처를 인용하는 데 그치기 쉽지만, `@wiki research`는 원천자료를 `raw/`에 남긴다.
- 일반 딥리서치는 이번 결과가 중심이고, `@wiki research`는 다음 `query`, `output`, `audit`에서 재사용될 지식 상태를 만든다.
- 일반 딥리서치는 검토가 답변 품질 확인에 머물 수 있지만, `@wiki research`는 출처 품질, article confidence, lint, audit으로 이어지는 검증 흐름을 갖는다.

정리하면 딥리서치는 "찾아서 정리해줘"이고, `@wiki research`는 "찾고, 출처를 보존하고, 위키 article로 합성해서 다음 작업에 재사용 가능하게 만들어줘"에 가깝다.

### plan

위키 내용을 근거로 실행계획을 만든다. 구현계획, 리서치 계획, 강의 제작 계획, 산출물 제작 계획처럼 단계와 검증 기준이 필요한 작업에 쓴다.

```markdown
@wiki plan 문제정의와 가설검증 article을 바탕으로 90분 강의 모듈 제작 계획을 만들어줘.
완료 기준과 검증 방법을 포함해줘.
```

plan은 필요하면 위키의 gap을 보고 추가 질문이나 보강 리서치를 제안할 수 있다.

`plan`은 research의 계획형 실행과 구분한다. research 쪽 계획은 조사 경로를 나누는 실행 방식이고, `@wiki plan`은 사용자가 수행할 구현계획, 강의 제작 계획, 운영계획 같은 산출물을 만드는 기능이다.

### output

위키 내용을 바탕으로 저장되는 산출물을 만든다. query 답변을 재사용 가능한 문서로 남기고 싶을 때 사용한다.

```markdown
@wiki output 문제정의와 가설검증을 강의용 1페이지 핸드아웃으로 만들어줘.
수강생이 바로 실습할 수 있는 질문 포함.
```

```markdown
@wiki output AI 협업과 문제정의 article을 바탕으로 실습지 초안을 만들어줘.
```

산출물은 보통 `output/`에 저장된다. 이미지, CSV, 코드 등 부속 파일이 생기는 산출물은 project 구조가 필요할 수 있다.

좋은 output 요청에는 대상 독자, 산출물 형식, 분량, 반드시 포함할 섹션, 사용하지 말아야 할 범위가 들어간다. 단순히 답을 듣고 싶으면 `query`, 재사용 가능한 문서로 남기고 싶으면 `output`을 선택한다.

### audit

위키 article이나 output artifact를 믿어도 되는지 검토한다. 근거가 약하거나, 오래됐거나, 외부 검증이 필요한 경우 사용한다.

```markdown
@wiki audit 문제정의와 가설검증 article의 근거와 신뢰성을 점검해줘.
```

```markdown
@wiki audit output/강의핸드아웃.md 산출물을 강의에 써도 되는지 검토해줘.
```

audit은 단순 오탈자 검토가 아니라 근거 체인, provenance, freshness, 모순 가능성을 확인하는 작업이다.

audit은 부족한 근거를 자동으로 채워 넣는 기능이 아니다. 근거가 약하다는 결론이 나오면 추가 ingest, research, compile이 다음 조치가 된다.

## 상황별 요청 템플릿

### 새 자료를 위키에 넣고 싶을 때

```markdown
@wiki ingest 이 자료를 현재 wiki의 raw source로 보존해줘.
이후 강의 설계에 쓸 수 있게 source summary와 tag를 정리해줘.
```

```markdown
@wiki compile 방금 ingest한 자료를 기존 article과 연결해줘.
필요하면 새 concept/reference article을 만들어줘.
```

```markdown
@wiki lint 구조와 index를 점검해줘.
```

### 있는 자료에서 답만 받고 싶을 때

```markdown
@wiki query [개념명]을 [사용 목적] 관점에서 정리해줘.
근거 article과 부족한 gap도 함께 알려줘.
```

### 저장되는 문서를 만들고 싶을 때

```markdown
@wiki output [개념명] article을 바탕으로 [산출물 형식]을 만들어줘.
대상 독자, 분량, 포함할 섹션은 다음과 같아.
```

### 위키에 근거가 부족할 때

```markdown
@wiki research [주제]에 대해 현재 wiki의 gap을 먼저 확인하고,
부족한 근거를 보강할 source를 찾아 ingest/compile까지 진행해줘.
```

### 결과를 믿어도 되는지 확인할 때

```markdown
@wiki audit [article 또는 output 경로]의 source chain, freshness, confidence를 점검해줘.
강의에 사용할 때 주의할 점도 알려줘.
```

## 확장 기능

### inventory

나중에 처리할 source 후보, open question, task, corpus 같은 durable tracking record를 관리한다. 지금 바로 ingest할 자료가 아니라 판단 대기 목록이면 inventory가 더 적합하다.

```markdown
@wiki inventory에 "AI 리서치 사례 모음"을 ingest 후보로 등록해줘.
```

### dataset

크거나 외부에 있는 데이터셋을 wiki 안에 복사하지 않고 manifest, sample, profile, query recipe로 색인한다.

```markdown
@wiki dataset으로 "고객 인터뷰 CSV"를 등록해줘. 실제 파일 위치는 D:/data/interviews.csv야.
```

### archive

더 이상 기본 context에 포함하고 싶지 않은 topic wiki를 조용히 보존한다. 일반 query, compile, research에서는 archived wiki가 기본적으로 제외된다.

```markdown
@wiki old-topic topic wiki를 archive 처리해줘.
```

### librarian

wiki article의 품질, 신선도, 중복, coherence를 점검하는 유지보수 흐름이다. 보통 대규모 wiki를 오래 운영할 때 사용한다.

```markdown
@wiki librarian으로 article 품질과 신선도를 스캔해줘.
```

### refresh

source URL이나 article freshness를 다시 확인한다. 자동 재컴파일이 아니라 변경 여부와 조치 필요성을 점검하는 성격이다.

```markdown
@wiki refresh가 필요한 article을 확인해줘.
```

### project

여러 output artifact를 하나의 목표 아래 묶는다. output에 부속 파일이 생기거나 산출물이 여러 개로 이어질 때 사용한다.

```markdown
@wiki lecture-handout project를 만들어줘. 목적은 문제정의 강의 핸드아웃 묶음 관리야.
```

## 운영 원칙

- 먼저 index를 읽고 관련 article을 확인한다.
- raw는 원천자료이고, wiki article은 합성 지식이다.
- query는 답변, output은 저장 산출물이다.
- 답변이 약하면 prompt를 장황하게 만들기보다 ingest/compile 상태를 확인한다.
- research는 위키를 바꾸는 보강 작업이므로 목적과 범위를 분명히 한다.
- write 작업 뒤에는 lint로 구조를 확인한다.
- 근거 신뢰성이 중요하면 audit을 사용한다.
- `.wiki/`를 수동으로 대량 편집하지 말고 LLM Wiki workflow로 관리한다.

## 좋은 요청의 기준

좋은 요청은 workflow, anchor term, 목적, 원하는 결과 형태가 분명하다.

```markdown
@wiki query 문제정의와 가설검증을 다우기술 신입 7H 강의의 2세션 도입부에서 쓰려고 한다.
핵심 메시지, 수강생 오개념, 실습 질문을 구분해서 정리해줘.
```

나쁜 요청은 범위와 근거가 불분명하다.

```markdown
@wiki 이거 정리해줘.
```

명확한 요청은 LLM에게 더 친절해서가 아니라, wiki의 어떤 article과 source chain을 읽어야 하는지 좁혀주기 때문에 안정적이다.

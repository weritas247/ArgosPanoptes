# git-init-template

웹 프로젝트를 시작할 때 기본으로 사용하는 초기 설정 템플릿.

## 포함 파일

| 파일 | 설명 |
|------|------|
| `.gitignore` | node_modules, dist, env, 로그 등 제외 |
| `.editorconfig` | 에디터 간 코딩 스타일 통일 (스페이스 2칸, UTF-8, LF) |
| `.prettierrc` | 코드 포맷팅 규칙 (싱글쿼트, 세미콜론, 줄폭 100자) |

## 사용법

```bash
# 1. 템플릿 클론
git clone https://github.com/weritas247/git-init-template.git my-project

# 2. 기존 git 히스토리 제거 후 새로 시작
cd my-project
rm -rf .git
git init
```

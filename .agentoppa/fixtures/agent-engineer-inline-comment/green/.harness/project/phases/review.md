---
name: review
desc: 변경을 검토.
consumes: [spec?]
produces: review
gate: "Critical 0건"
workers:
  select: dynamic
  options:
    code-reviewer: "코드가 바뀌면"
---
변경 검토. 산출 {review}. → {next}

package main

// 题库合并：questions.json（从 Go.html 抽取的 210 道题）+ content/questions 新增题目
// + content/deep 深入讲解 → src/data/bank.json（前端使用）。

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Category struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
	Desc string `json:"desc"`
}

type Question struct {
	ID     string  `json:"id"`
	Code   string  `json:"code"`
	Cat    string  `json:"cat"`
	Group  *string `json:"group"`
	Level  int     `json:"level"`
	Hot    bool    `json:"hot"`
	Title  string  `json:"title"`
	Answer string  `json:"answer"`
	Deep   string  `json:"deep,omitempty"`
	New    bool    `json:"new,omitempty"`
}

type Bank struct {
	Title      string     `json:"title"`
	Footer     string     `json:"footer"`
	Categories []Category `json:"categories"`
	Questions  []Question `json:"questions"`
}

func groupKey(g *string) string {
	if g == nil {
		return ""
	}
	return *g
}

func loadBank(base, contentDir string) (*Bank, []string, error) {
	data, err := os.ReadFile(base)
	if err != nil {
		return nil, nil, fmt.Errorf("读取 %s 失败（先运行 pnpm extract）：%w", base, err)
	}
	var b Bank
	if err := json.Unmarshal(data, &b); err != nil {
		return nil, nil, err
	}
	var problems []string
	cats := map[string]bool{}
	for _, c := range b.Categories {
		cats[c.ID] = true
	}

	// 新增题目：插到同一领域、同一分组的最后一道题后面
	newItems, err := loadDir(filepath.Join(contentDir, "questions"))
	if err != nil {
		return nil, nil, err
	}
	index := map[string]bool{}
	for _, q := range b.Questions {
		index[q.ID] = true
	}
	for _, it := range newItems {
		where := fmt.Sprintf("%s:%d", it.File, it.Line)
		cat, _, _ := strings.Cut(it.ID, "-")
		if !cats[cat] {
			problems = append(problems, fmt.Sprintf("%s: 未知领域 %s", where, cat))
			continue
		}
		if index[it.ID] {
			problems = append(problems, fmt.Sprintf("%s: 题目 id %s 重复", where, it.ID))
			continue
		}
		level, err := strconv.Atoi(it.Meta["level"])
		if err != nil || level < 1 || level > 3 {
			problems = append(problems, fmt.Sprintf("%s: level 必须是 1～3", where))
			continue
		}
		if it.Meta["title"] == "" || strings.TrimSpace(it.Sections["answer"]) == "" {
			problems = append(problems, fmt.Sprintf("%s: 缺少 title 或 --- answer", where))
			continue
		}
		q := Question{
			ID:     it.ID,
			Code:   strings.ToUpper(it.ID),
			Cat:    cat,
			Level:  level,
			Hot:    it.Meta["hot"] == "true",
			Title:  it.Meta["title"],
			Answer: it.Sections["answer"],
			Deep:   it.Sections["deep"],
			New:    true,
		}
		if g := it.Meta["group"]; g != "" {
			q.Group = &g
		}
		// 先找同组最后一道；没有同组就放在领域末尾
		last, lastInCat := -1, -1
		for i, e := range b.Questions {
			if e.Cat == cat {
				lastInCat = i
				if groupKey(e.Group) == groupKey(q.Group) {
					last = i
				}
			}
		}
		if last < 0 {
			last = lastInCat
		}
		b.Questions = append(b.Questions[:last+1], append([]Question{q}, b.Questions[last+1:]...)...)
		index[it.ID] = true
	}

	// 深入讲解
	deepItems, err := loadDir(filepath.Join(contentDir, "deep"))
	if err != nil {
		return nil, nil, err
	}
	pos := map[string]int{}
	for i, q := range b.Questions {
		pos[q.ID] = i
	}
	for _, it := range deepItems {
		i, ok := pos[it.ID]
		if !ok {
			problems = append(problems, fmt.Sprintf("%s:%d: 深入讲解对应的题目 %s 不存在", it.File, it.Line, it.ID))
			continue
		}
		if strings.TrimSpace(it.Sections["deep"]) == "" {
			problems = append(problems, fmt.Sprintf("%s:%d: 缺少 --- deep", it.File, it.Line))
			continue
		}
		b.Questions[i].Deep = it.Sections["deep"]
	}
	return &b, problems, nil
}

// loadOverrides 读取 content/<dir>/*.txt 里 "=== id / --- <section>" 形式的覆盖内容
func loadOverrides(dir, section string) (map[string]string, []string, error) {
	items, err := loadDir(dir)
	if err != nil {
		return nil, nil, err
	}
	out := map[string]string{}
	var problems []string
	for _, it := range items {
		body := strings.TrimSpace(it.Sections[section])
		if body == "" {
			problems = append(problems, fmt.Sprintf("%s:%d: %s 缺少 --- %s", it.File, it.Line, it.ID, section))
			continue
		}
		if _, dup := out[it.ID]; dup {
			problems = append(problems, fmt.Sprintf("%s:%d: %s 重复", it.File, it.Line, it.ID))
			continue
		}
		out[it.ID] = body
	}
	return out, problems, nil
}

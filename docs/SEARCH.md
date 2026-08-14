# Trudesk Search — Technical Reference

Trudesk full-text search is backed by an **Elasticsearch** index named `trudesk`.
The index is rebuilt from MongoDB and kept in sync on every ticket create /
update / delete. This document describes how the search behaves and what its
limits are.

---

## 1. Indexed fields

Each ticket is indexed with the following searchable fields:

| Field | Content | Notes |
|---|---|---|
| `uid` | Ticket number | Exact numeric match, highest precision |
| `subject` | Ticket title | Boosted (weight `^5`) |
| `issue` | Ticket body / description | Boosted (weight `^5`) |
| `comments.comment` | All comment text | Weight `^3` |
| `notes.note` | Internal notes | Weight `^3` |
| `owner.fullname` / `owner.username` / `owner.email` | Author identity | Weight `^1` |
| `comments.owner.email` | Commenter emails | Weight `^1` |
| `group.name`, `tags.normalized`, `priority.name`, `ticketType.name`, `type.name` | Classification labels | Weight `^1` |
| `dateFormatted` | Human-readable creation date | e.g. `August 1 2026` |

**Result card display.** The search dropdown shows only status color, priority
dot, `uid`, `subject`, and a sanitized snippet of `issue`. A ticket may match
via a comment or note even when the query term is not visible in the card.
There is **no term highlighting** in the UI.

---

## 2. Query semantics

### 2.1 Multi-field `cross_fields` + `AND`
The query is a `multi_match` with `type: cross_fields` and `operator: and`.
Every term you type must be present **somewhere** across the indexed fields
of a single ticket (they may be spread across different fields).

```
Query: pdf download
→ 12 tickets, each containing both "pdf" AND "download"
   (e.g. "pdf" in subject, "download" in a comment)
```

More terms → narrower, more precise results.

### 2.2 Relevance ranking (field weights)
Results are ranked by a relevance score. Fields contribute differently:

```
uid^5  subject^5  issue^5  comments.comment^3  notes.note^3  (others ^1)
```

```
Query: refund
→ 25 tickets. Top results have "refund" in the subject
   ("removing refund record"); matches that occur only in
   comments rank lower.
```

### 2.3 Ticket number lookup
A numeric query matches `uid` with the highest precision.

```
Query: 1495
→ 1 ticket: #1495 "BP PDF error"
```

---

## 3. Text analysis

Each text field is indexed **twice** (multi-fields), and a query matches both.

### 3.1 Prefix matching (analyzer `leadahead`)
Index-time `edge_ngram` (min 1, max 20) over the raw token. Supports
"type-ahead" style queries: a query matches any word that **starts with** the
query text.

```
Query: down
→ matches "download", "downloading"  (52 tickets)
```

Limitation: it is prefix-only. A substring in the middle of a word does not
match.

```
Query: nload
→ 0 results ("download" does not START with "nload")
```

### 3.2 English stemming (analyzer `english_text`, sub-field `.stemmed`)
Index- and search-time English stemming (`possessive_english` + `lowercase` +
`english` stemmer). Different inflections of a word reduce to a common root.

```
Query: payment
→ matches "payment", "payments", "payed"  (190 tickets)
   #1587 "Payment recorded incorrectly"
   #1584 "Issue with Payment link - payment made to a different..."

Query: errors  ==  Query: error   → identical result sets
```

---

## 4. Limitations

| Capability | Status | Example |
|---|---|---|
| Substring (mid-word) matching | Not supported | `nload` ≠ "download" |
| Typo tolerance / fuzzy matching | Not supported | `paymnet` ≠ "payment" |
| Russian morphology | Not enabled | "ошибки" ≠ "ошибка" |
| Term highlighting in UI | Not implemented | match location not shown |
| Exact-phrase search | Not exposed in UI | query uses AND, not phrase |

---

## 5. Operational notes

- **Rebuild.** Admin → Settings → Elasticsearch → Rebuild Index recreates the
  index from MongoDB (required after mapping/analyzer changes).
- **Endpoint.** `GET /api/v2/es/search?limit=<n>&q=<term>` (term is
  URL-encoded by the client).
- **Network.** Elasticsearch is bound to `127.0.0.1:9200` and is not reachable
  externally.
- **Index mapping / analyzer definitions** live in
  `src/elasticsearch/rebuildIndexChild.js`; the query lives in
  `src/controllers/api/v2/elasticsearch.js`.

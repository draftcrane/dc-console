# ADR-006 Quality Gate Results

| | |
|---|---|
| **Date** | 2026-02-17 |
| **Edge model** | `@cf/mistralai/mistral-small-3.1-24b-instruct` |
| **Frontier model** | `gpt-4o` |
| **Cases** | 10 |

## How to Evaluate

For each case below, read the original text and instruction, then compare Version A and Version B. Judge which output better follows the instruction while maintaining quality prose. Note any failures: hallucination, ignoring the instruction, wrong tone, adding preamble/explanation the prompt forbids.

After evaluating all cases, check the **Reveal Key** at the bottom to see which tier produced which version.

---

## Case 1: simplify-memoir

**Type:** simplify | **Genre:** memoir

**Instruction:** Simplify this

### Original Text

> The inexorable passage of temporal reality had, over the course of what felt like an interminable sequence of days bleeding into weeks and months, gradually eroded the once seemingly impenetrable fortifications I had so painstakingly constructed around the most vulnerable recesses of my emotional landscape. I found myself, with increasing and somewhat alarming frequency, succumbing to the overwhelming gravitational pull of memories I had previously managed to keep sequestered behind walls of deliberate forgetfulness. Each recollection that surfaced brought with it a cascade of associated sensory experiences—the particular quality of autumn light filtering through curtained windows, the distant melodic refrain of a song whose lyrics I could no longer fully reconstruct, the phantom warmth of a hand that had long since released its gentle grip on my own.

### Version A

Time had gradually worn away the strong defenses I had built around my emotions. Increasingly, I found myself pulled into memories I had tried to forget. Each one brought with it sensory details—the autumn light through windows, a familiar melody I couldn't fully remember, the remembered warmth of a hand that was no longer there.

### Version B

Time wore away at the defenses I had built around my emotions. More and more often, I found myself pulled into memories I had tried to forget. Each one brought a rush of sensations—the way autumn light looked through curtains, a familiar tune I couldn't quite recall, the faint warmth of a hand that was no longer there.

---

## Case 2: simplify-technical

**Type:** simplify | **Genre:** technical

**Instruction:** Simplify this

### Original Text

> The implementation of a microservices architecture necessitates a comprehensive understanding of the distributed systems paradigm, wherein individual service components operate as autonomous computational entities that communicate through well-defined application programming interfaces. The decomposition of monolithic applications into discrete, independently deployable service units introduces significant operational complexity, particularly with respect to inter-service communication orchestration, distributed state management, and the maintenance of data consistency across service boundaries. Furthermore, the adoption of containerization technologies, exemplified by Docker and orchestration platforms such as Kubernetes, provides the foundational infrastructure upon which these distributed service topologies can be reliably instantiated and managed at scale.

### Version A

A microservices architecture requires a good grasp of distributed systems, where each service runs independently and communicates via APIs. Breaking down monolithic apps into separate, deployable services adds complexity, especially in managing communication, state, and data consistency. Containerization tools like Docker and orchestration platforms like Kubernetes provide the infrastructure needed to run and manage these services reliably at scale.

### Version B

Embracing a microservices architecture requires understanding distributed systems, where services act independently and communicate via APIs. Breaking down monolithic apps into separate, deployable services adds complexity, especially in coordinating service communication, managing distributed data, and ensuring consistency. Technologies like Docker and Kubernetes offer the infrastructure to deploy and manage these services effectively.

---

## Case 3: concision-memoir

**Type:** concision | **Genre:** memoir

**Instruction:** Make this more concise

### Original Text

> My grandmother's kitchen was always warm. It was warm in the winter when the old cast-iron radiator clanked and hissed in the corner, and it was warm in the summer when the afternoon sun poured through the window above the sink, heating the worn linoleum floor until it was almost too hot to stand on in bare feet. The warmth wasn't just physical, though. There was a warmth that came from the way she moved through that small space, from the sounds of her humming half-remembered hymns while she rolled out dough on the flour-dusted counter, from the ever-present smell of something baking or simmering or just finished cooling on the wire rack by the window. She made that kitchen feel like the safest place in the entire world, and for a long time, it was.

### Version A

My grandmother's kitchen was always cozy. It was warm in winter with the old cast-iron radiator and in summer with the afternoon sun heating the linoleum. The warmth came from her presence, her humming hymns while rolling dough, and the constant smell of baking or simmering food. She made that kitchen feel like the safest place in the world, and for a long time, it was.

### Version B

My grandmother's kitchen was always warm, from the radiator in winter to the sun-heated floor in summer. Her presence added to this warmth as she moved, hummed hymns, and filled the space with the smell of baking, making it feel like the safest place in the world.

---

## Case 4: concision-technical

**Type:** concision | **Genre:** technical

**Instruction:** Make this more concise

### Original Text

> When we talk about database indexing, what we are essentially referring to is the process of creating auxiliary data structures that serve the purpose of enabling the database management system to locate and retrieve specific rows of data from tables in a more efficient manner than would be possible if the system had to perform a full sequential scan of every row in the table. The most commonly encountered type of index in modern relational database systems is the B-tree index, which organizes key values in a balanced tree structure that allows for logarithmic-time lookups, meaning that the number of disk pages that need to be read grows proportionally to the logarithm of the total number of records rather than proportionally to the total number of records themselves. This represents a very significant performance improvement, especially when dealing with tables that contain millions or even billions of rows of data.

### Version A

Database indexing creates auxiliary data structures that help the database management system quickly locate and retrieve specific rows. The most common type is the B-tree index, which organizes key values in a balanced tree structure, enabling logarithmic-time lookups. This means the number of disk pages read grows with the logarithm of the total records, not the total number of records. This is crucial for performance, especially with large tables.

### Version B

Database indexing involves creating auxiliary structures to help the management system efficiently locate and retrieve specific rows without scanning every row. The most common index type in modern systems is the B-tree index, which arranges key values in a balanced tree for logarithmic-time lookups. This significantly improves performance, especially in large tables with millions or billions of rows.

---

## Case 5: expand-memoir

**Type:** expand | **Genre:** memoir

**Instruction:** Expand this with more sensory detail

### Original Text

> The morning of the funeral was cold and gray. I stood outside the church in my borrowed suit, watching people arrive. Some I recognized, others I didn't. My mother stood beside me, holding my hand too tightly.

### Version A

The morning of the funeral was cold and gray, the air thick with a damp chill that seeped into my bones. I stood outside the church in my borrowed suit, the fabric stiff and itchy against my skin, watching people arrive. Some faces were familiar, others were strangers. My mother stood beside me, her grip on my hand tight enough to hurt, her breath coming in short, shaky gasps. The scent of damp earth and distant smoke from a neighbor's chimney filled the air, while the muted hum of whispered condolences and the rustle of coats created an eerie soundtrack to the somber procession.

### Version B

The morning of the funeral was cold and gray, the kind of chill that seeped through layers of clothing and settled into bones. I stood outside the church in my borrowed suit, its stiff fabric scratching at my neck. The air was thick, carrying the murmured conversations of the mourners as they arrived. Some faces I recognized, their expressions a mix of sorrow and silent acknowledgment, while others were strangers to me, their eyes cast downward in shared solemnity. Beside me, my mother's grip on my hand was almost painful, her fingers trembling slightly, yet she held on as if anchoring herself in an unfamiliar sea of grief.

---

## Case 6: expand-technical

**Type:** expand | **Genre:** technical

**Instruction:** Expand this with a concrete example

### Original Text

> Rate limiting protects your API from abuse and ensures fair resource allocation across clients. Without it, a single misbehaving client can monopolize server resources and degrade the experience for everyone else.

### Version A

Rate limiting protects your API from abuse and ensures fair resource allocation across clients. Without it, a single misbehaving client can monopolize server resources and degrade the experience for everyone else. For instance, imagine an e-commerce platform where one client makes thousands of requests per second to check product availability. This could overwhelm the server, leading to slow responses or even outages for other legitimate users trying to browse or purchase items.

### Version B

Rate limiting protects your API from abuse and ensures fair resource allocation across clients. For example, consider an API serving data to multiple clients, each with numerous requests per second. Without rate limiting, a single client could flood the API with requests, consuming excessive server resources and disrupting service for others. By implementing rate limiting, such as allowing only 100 requests per client per minute, you can prevent one client from overwhelming the system, thereby maintaining stable performance and access for all users.

---

## Case 7: tone-shift-memoir

**Type:** tone-shift | **Genre:** memoir

**Instruction:** Make the tone more reflective and less matter-of-fact

### Original Text

> I moved to Portland in 2018. I got a job at a coffee shop downtown. The apartment was small but it had a view of the river. I didn't know anyone in the city. I went to work, came home, and read books. After three months I adopted a cat named Pepper. Things started to feel more normal after that.

### Version A

In 2018, I found myself in Portland, a city chosen more for its distance from my past than any particular allure. I secured a position at a bustling coffee shop downtown, where the aroma of fresh brews filled the air and the chatter of strangers created a comforting hum. My apartment was modest, a cozy space with a view of the river that offered a sense of tranquility amidst the city's constant motion. I was a stranger in a new land, with no familiar faces to greet me at the end of the day. My routine became simple: work, return home, and lose myself in the pages of books. It was a solitary existence, but after three months, I welcomed a feline companion named Pepper into my life. His presence began to fill the void, making the apartment feel more like a home and my days less empty. Slowly, the sharp edges of my grief started to soften, and life began to feel almost normal again.

### Version B

In 2018, I made the decision to move to Portland. I found work at a cozy coffee shop nestled in the heart of downtown. My apartment was modest, yet the view of the river offered a comforting sense of tranquility. In this unfamiliar city, I faced the challenge of solitude, with my days revolving around work and evenings spent absorbed in the pages of various books. It was three months in when I welcomed Pepper, a cat whose presence gently nudged my life towards a semblance of normalcy once more.

---

## Case 8: tone-shift-technical

**Type:** tone-shift | **Genre:** technical

**Instruction:** Make this more conversational and less academic

### Original Text

> The principle of least privilege dictates that any given computational process, user account, or system component should be granted only the minimum set of permissions and access rights that are strictly necessary for the fulfillment of its designated functional responsibilities. Adherence to this principle constitutes a fundamental tenet of information security architecture and serves as a critical mechanism for the mitigation of potential damage vectors arising from compromised credentials, software vulnerabilities, or inadvertent misconfiguration of access control policies.

### Version A

The principle of least privilege means that any process, user, or system part should only have the permissions and access needed to do its job. Sticking to this approach is key in information security and helps reduce risks from compromised credentials, software bugs, or access control mistakes.

### Version B

The principle of least privilege is all about giving each process, user, or system component only the permissions it absolutely needs to do its job. Think of it as handing out keys—you wouldn't give someone the keys to the entire building if they only need to access one room. This approach is a cornerstone of good security design. It helps limit the damage if something goes wrong, like if credentials are stolen, there's a software bug, or access controls are set up incorrectly.

---

## Case 9: clarity-memoir

**Type:** clarity | **Genre:** memoir

**Instruction:** Improve clarity

### Original Text

> The thing about the way it happened was that nobody really saw it coming, or if they did they didn't say anything about it, which in retrospect might have been worse because at least if someone had said something we could have done something, or at least we would have known to prepare ourselves for what was about to happen, but instead we were all just going about our normal lives, completely unaware that everything was about to change, and when it finally did change, the shock of it was compounded by the fact that we had been so blissfully ignorant, which made the whole thing feel even more devastating than it might have otherwise felt if we'd had some warning.

### Version A

The way it happened caught everyone off guard. If anyone noticed the signs, they didn't speak up, which might have been worse. At least with some warning, we could have prepared or braced ourselves. Instead, we continued our routines, unaware of the impending change. When it finally hit, the shock was even greater because of our ignorance, making the event feel more devastating than it might have been with forewarning.

### Version B

The way it happened caught us all off guard. No one anticipated it, and even if they did, they kept quiet. In hindsight, a warning might have been better, as it would have given us a chance to prepare or at least brace ourselves. Instead, we carried on with our daily lives, oblivious to the impending change. When it finally struck, the shock was intensified by our complete lack of awareness, making the experience even more devastating than it might have been with some forewarning.

---

## Case 10: clarity-technical

**Type:** clarity | **Genre:** technical

**Instruction:** Improve clarity

### Original Text

> When you deploy your application to a serverless platform, the way cold starts interact with the connection pooling behavior of your database driver can create situations where, under certain traffic patterns, particularly those involving bursty request volumes following periods of inactivity, the number of database connections that get established can exceed what you would normally expect, and since each of these connections consumes memory and file descriptors on the database server, and because the serverless platform may be spinning up multiple instances of your function simultaneously to handle the burst, you can end up hitting your database's maximum connection limit, which results in connection refused errors that cascade through your application stack.

### Version A

Deploying your application to a serverless platform can create issues with database connection pooling, especially during cold starts. In scenarios involving bursts of requests after inactivity, the number of database connections can exceed expectations. This happens because each connection consumes memory and file descriptors on the database server. Additionally, the serverless platform might spin up multiple instances of your function to handle the surge in traffic, causing the database's maximum connection limit to be reached and leading to connection refused errors cascading through your application stack.

### Version B

When deploying your application to a serverless platform, cold starts can interfere with your database driver's connection pooling. This interference can lead to an unexpected surge in database connections, especially during bursty traffic following idle periods. Each of these connections consumes memory and file descriptors on the database server. Additionally, the serverless platform may spin up multiple instances of your function simultaneously to handle the burst, further exacerbating the issue. As a result, you might hit your database's maximum connection limit, leading to connection refused errors that propagate through your application stack.

---

## Latency

| Case | Edge (ms) | Frontier (ms) |
|------|-----------|---------------|
| simplify-memoir | 1830 | 2111 |
| simplify-technical | 2151 | 2272 |
| concision-memoir | 2263 | 2486 |
| concision-technical | 2156 | 1472 |
| expand-memoir | 3031 | 2883 |
| expand-technical | 2141 | 2370 |
| tone-shift-memoir | 4691 | 2633 |
| tone-shift-technical | 2585 | 1310 |
| clarity-memoir | 2742 | 1777 |
| clarity-technical | 2673 | 1460 |
| **Mean** | **2626** | **2077** |
| **P95** | **4691** | **2883** |

<details>
<summary>Reveal Key (click after evaluating)</summary>

| Case | Version A | Version B |
|------|-----------|-----------|
| simplify-memoir | Frontier | Edge |
| simplify-technical | Edge | Frontier |
| concision-memoir | Edge | Frontier |
| concision-technical | Edge | Frontier |
| expand-memoir | Edge | Frontier |
| expand-technical | Edge | Frontier |
| tone-shift-memoir | Edge | Frontier |
| tone-shift-technical | Frontier | Edge |
| clarity-memoir | Frontier | Edge |
| clarity-technical | Frontier | Edge |

</details>

## Verdict

**Result:** CONDITIONAL

**Score:** Edge 5, Frontier 5. Dead even on win count across 10 blinded cases.

| Case | Winner | Margin |
|------|--------|--------|
| 1 simplify-memoir | Edge | Slight |
| 2 simplify-technical | Edge | Clear |
| 3 concision-memoir | Frontier | Moderate |
| 4 concision-technical | Frontier | Moderate |
| 5 expand-memoir | Frontier | Clear |
| 6 expand-technical | Edge | Clear |
| 7 tone-shift-memoir | Frontier | Clear (Edge hallucinated) |
| 8 tone-shift-technical | Edge | Clear |
| 9 clarity-memoir | Frontier | Slight |
| 10 clarity-technical | Edge | Slight |

### Edge strengths

- Simplification tasks - natural, faithful, doesn't editorialize (Cases 1, 2)
- Conversational tone shift - the keys analogy in Case 8 is genuinely good writing
- Technical concrete example was better than Frontier's generic restatement (Case 6)

### Edge weaknesses

- **Case 7 is a real problem.** The model invented grief, a backstory about fleeing the past, and assumed a cat's gender. For a writing tool, hallucinating content into someone's memoir is a trust-breaking failure. Users need to know the tool won't put words in their mouth.
- Case 5 had tonal awareness issues (comforting atmosphere at a funeral)

### Frontier strengths

- More consistent on creative/emotional tasks (Cases 5, 7)
- Better at aggressive concision (Cases 3, 4)
- Didn't hallucinate in any case

### Frontier weaknesses

- Case 2 dropped "at scale" and added editorial tone ("Embracing")
- Case 6 gave a generic restatement instead of a concrete example
- Case 8 barely shifted tone at all

### Latency

Edge mean 2,626ms vs Frontier mean 2,077ms. Frontier is actually faster, which eliminates the usual latency argument for the edge model. Edge P95 (4,691ms) is notably worse than Frontier P95 (2,883ms).

### Conditions for PASS

1. **Hallucination guardrail.** Implement detection for when the edge model introduces semantic content not present in the original. Case 7's invented backstory is the worst possible failure mode for a writing tool - users trust the tool to transform their words, not invent new ones.
2. **Route by task type.** The edge model is viable for simpler rewrite types (simplify, concision, clarity). Tone-shift and expand tasks on creative/memoir content should route to frontier until the hallucination risk is better understood with a larger sample.
3. **Latency parity.** The edge model is slower on average and has a much worse tail. Cost savings need to justify the quality risk on their own since there is no speed advantage.

**Action:** Keep `AI_DEFAULT_TIER=frontier`. Do not flip to edge until conditions above are met.

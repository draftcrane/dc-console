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

The steady march of time slowly wore away at the defenses I had built around my most sensitive emotions. I found myself more and more often drawn back to memories I had tried to lock away. Each one brought a rush of related sensations—the way autumn light filled a room, a familiar tune playing faintly in the distance, the lingering warmth of a hand that was no longer there.

### Version B

Time, over what felt like endless days turning into weeks and months, slowly wore down the strong walls I had built to protect my heart. I found myself more frequently drawn into memories I had tried to forget, each one carrying flashes of familiar sensations—the autumn light through the curtains, a tune whose words I couldn't quite remember, the warmth of a hand I could no longer hold.

---

## Case 2: simplify-technical

**Type:** simplify | **Genre:** technical

**Instruction:** Simplify this

### Original Text

> The implementation of a microservices architecture necessitates a comprehensive understanding of the distributed systems paradigm, wherein individual service components operate as autonomous computational entities that communicate through well-defined application programming interfaces. The decomposition of monolithic applications into discrete, independently deployable service units introduces significant operational complexity, particularly with respect to inter-service communication orchestration, distributed state management, and the maintenance of data consistency across service boundaries. Furthermore, the adoption of containerization technologies, exemplified by Docker and orchestration platforms such as Kubernetes, provides the foundational infrastructure upon which these distributed service topologies can be reliably instantiated and managed at scale.

### Version A

Implementing microservices requires a solid grasp of distributed systems, where each service runs independently and communicates via APIs. Breaking down monolithic apps into separate, deployable services adds complexity, especially in managing communication, distributed state, and data consistency. Containerization tools like Docker and orchestration platforms like Kubernetes provide the infrastructure to run and manage these services reliably at scale.

### Version B

Implementing a microservices architecture requires a solid grasp of distributed systems, where services function independently and communicate via clear APIs. Breaking down a monolithic app into individual services increases complexity, especially in coordinating communication, managing distributed states, and keeping data consistent. Tools like Docker and Kubernetes offer the necessary infrastructure to effectively deploy and manage these services on a large scale.

---

## Case 3: concision-memoir

**Type:** concision | **Genre:** memoir

**Instruction:** Make this more concise

### Original Text

> My grandmother's kitchen was always warm. It was warm in the winter when the old cast-iron radiator clanked and hissed in the corner, and it was warm in the summer when the afternoon sun poured through the window above the sink, heating the worn linoleum floor until it was almost too hot to stand on in bare feet. The warmth wasn't just physical, though. There was a warmth that came from the way she moved through that small space, from the sounds of her humming half-remembered hymns while she rolled out dough on the flour-dusted counter, from the ever-present smell of something baking or simmering or just finished cooling on the wire rack by the window. She made that kitchen feel like the safest place in the entire world, and for a long time, it was.

### Version A

My grandmother's kitchen was always cozy. It was warm in winter with the old cast-iron radiator and in summer with the sun heating the linoleum. But the true warmth came from her presence—humming hymns, rolling dough, and filling the air with the scent of baking. She made that kitchen feel like the safest place on earth, and for a long time, it was.

I wish I had paid more attention to her recipes. They died with her, leaving me with only sense memories.

### Version B

My grandmother's kitchen was always warm, whether from the clanking radiator in winter or the summer sun heating the floor. But the true warmth came from her presence—humming hymns as she rolled dough, the smell of something always baking or cooling. Her kitchen felt like the safest place, and for a long time, it was.

---

## Case 4: concision-technical

**Type:** concision | **Genre:** technical

**Instruction:** Make this more concise

### Original Text

> When we talk about database indexing, what we are essentially referring to is the process of creating auxiliary data structures that serve the purpose of enabling the database management system to locate and retrieve specific rows of data from tables in a more efficient manner than would be possible if the system had to perform a full sequential scan of every row in the table. The most commonly encountered type of index in modern relational database systems is the B-tree index, which organizes key values in a balanced tree structure that allows for logarithmic-time lookups, meaning that the number of disk pages that need to be read grows proportionally to the logarithm of the total number of records rather than proportionally to the total number of records themselves. This represents a very significant performance improvement, especially when dealing with tables that contain millions or even billions of rows of data.

### Version A

Database indexing creates auxiliary data structures to help the database management system quickly locate and retrieve specific rows. The most common type is the B-tree index, which organizes key values in a balanced tree structure, enabling logarithmic-time lookups. This means the number of disk pages read grows with the logarithm of the total records, not linearly, significantly improving performance for large tables.

### Version B

Database indexing involves creating auxiliary data structures to help the database system efficiently locate and retrieve specific rows from tables without requiring a full scan. The B-tree index, the most common type in modern relational databases, organizes key values in a balanced tree, allowing logarithmic-time lookups. This drastically improves performance, especially with tables containing millions or billions of rows.

---

## Case 5: expand-memoir

**Type:** expand | **Genre:** memoir

**Instruction:** Expand this with more sensory detail

### Original Text

> The morning of the funeral was cold and gray. I stood outside the church in my borrowed suit, watching people arrive. Some I recognized, others I didn't. My mother stood beside me, holding my hand too tightly.

### Version A

The morning of the funeral was cold and gray, the sky a blanket of overcast clouds. I stood outside the church in a borrowed suit that felt both too tight and too loose, scratching at my skin. The crisp air nipped at my cheeks, and a light drizzle began to fall, marking the pavements with dark spots. I watched as people arrived, some familiar faces softened with shared memories, while others were strangers whose glances lingered on my mother and me, perhaps offering silent condolences through their eyes. My mother's hand gripped mine with a force that communicated both her fear and her need for connection, the coolness of her fingers contrasting sharply with the warmth of her palm. The scent of damp earth and fading autumn leaves filled my senses, mingling with the faint hint of incense wafting from the church door.

### Version B

The morning of the funeral was cold and gray, the sky a blanket of dull, unbroken clouds. A sharp wind cut through my borrowed suit, which hung loosely on my frame, as if it belonged to someone else. I stood outside the church, the stone facade cold and unyielding against my back, watching people arrive. Some faces were familiar, others were strangers who moved with a somber purpose. The air was thick with the scent of damp earth and the faint, underlying smell of lilies from the floral arrangements inside. My mother stood beside me, her hand gripping mine too tightly, her fingers cold and trembling. The crunch of gravel underfoot and the muffled whispers of condolences filled the air, each sound echoing the finality of the day.

---

## Case 6: expand-technical

**Type:** expand | **Genre:** technical

**Instruction:** Expand this with a concrete example

### Original Text

> Rate limiting protects your API from abuse and ensures fair resource allocation across clients. Without it, a single misbehaving client can monopolize server resources and degrade the experience for everyone else.

### Version A

Rate limiting is a crucial mechanism to protect your API from abuse and ensure fair resource allocation across clients. Without it, a single misbehaving client can monopolize server resources, leading to degraded performance and a poor experience for all other users. For instance, consider an e-commerce platform where a rogue client makes thousands of requests per second to check product availability. This can overwhelm the server, causing legitimate users to experience slow response times or even timeouts. By implementing rate limiting, you can cap the number of requests a client can make within a specific time frame, thereby preventing such abuse and maintaining a consistent and reliable service for all users.

### Version B

Rate limiting acts as a safeguard against API abuse, ensuring that resources are fairly distributed among all clients. Imagine a scenario where your API serves an online shopping platform. Without rate limiting, a single client could repeatedly call the endpoint to check product availability, consuming excessive server resources and potentially slowing down response times for legitimate shoppers looking to make purchases. By implementing rate limiting, you can set a cap on the number of requests a client can make within a given timeframe. For instance, you might allow 100 requests per minute per user. If this threshold is exceeded, further requests from that client could either be delayed or denied temporarily, thereby maintaining optimal server performance for all users.

---

## Case 7: tone-shift-memoir

**Type:** tone-shift | **Genre:** memoir

**Instruction:** Make the tone more reflective and less matter-of-fact

### Original Text

> I moved to Portland in 2018. I got a job at a coffee shop downtown. The apartment was small but it had a view of the river. I didn't know anyone in the city. I went to work, came home, and read books. After three months I adopted a cat named Pepper. Things started to feel more normal after that.

### Version A

In 2018, I chose Portland as the backdrop for my fresh start. I secured a position at a bustling downtown coffee shop, and found a small apartment that offered a glimpse of the river. The city was a blank slate, devoid of familiar faces or shared histories. My days were filled with the rhythm of work, the quiet of my apartment, and the pages of countless books. It was a solitary existence, but it was mine. After three months of this routine, I welcomed a feline companion named Pepper into my life. His presence began to soften the edges of my solitude, making the world feel a little less empty and a little more like home.

### Version B

In 2018, I found myself starting anew in Portland. Securing a job at a downtown coffee shop, I settled into a modest apartment that offered a glimpse of the river. The city was unfamiliar, and my social circle was non-existent, leaving my days filled with work, quiet evenings, and the comfort of books. After a few months, I welcomed Pepper, a spirited cat, into my life. Her presence marked the beginning of feeling a bit more at ease in the world.

---

## Case 8: tone-shift-technical

**Type:** tone-shift | **Genre:** technical

**Instruction:** Make this more conversational and less academic

### Original Text

> The principle of least privilege dictates that any given computational process, user account, or system component should be granted only the minimum set of permissions and access rights that are strictly necessary for the fulfillment of its designated functional responsibilities. Adherence to this principle constitutes a fundamental tenet of information security architecture and serves as a critical mechanism for the mitigation of potential damage vectors arising from compromised credentials, software vulnerabilities, or inadvertent misconfiguration of access control policies.

### Version A

The principle of least privilege is all about giving each process, user, or system component only the permissions it absolutely needs to do its job. Think of it like giving someone a key to your house—you wouldn't hand over the master key if all they need is access to the guest room, right? This approach is a cornerstone of good security design and helps minimize the damage if something goes wrong, like if credentials are compromised or there's a software vulnerability.

[Text after selection]
In practice, this means your database user for a read-only reporting service should not have write permissions. Your frontend deployment pipeline should not have access to production secrets.

### Version B

The principle of least privilege means that any task, user, or system part should only have the permissions absolutely necessary to do its job. Sticking to this idea is key in information security because it helps limit damage if credentials are stolen, software bugs pop up, or access settings get messed up.

---

## Case 9: clarity-memoir

**Type:** clarity | **Genre:** memoir

**Instruction:** Improve clarity

### Original Text

> The thing about the way it happened was that nobody really saw it coming, or if they did they didn't say anything about it, which in retrospect might have been worse because at least if someone had said something we could have done something, or at least we would have known to prepare ourselves for what was about to happen, but instead we were all just going about our normal lives, completely unaware that everything was about to change, and when it finally did change, the shock of it was compounded by the fact that we had been so blissfully ignorant, which made the whole thing feel even more devastating than it might have otherwise felt if we'd had some warning.

### Version A

The way it happened took everyone by surprise. Even if someone had noticed the warning signs, they hadn’t mentioned them. In hindsight, that silence might have been more detrimental because with some forewarning, we could have taken steps or at least steeled ourselves for the upheaval ahead. Instead, we continued with our daily routines, unaware of the upcoming transformation. When the change finally occurred, it was even more shocking because of our blissful ignorance, amplifying the devastation we felt without the benefit of any advance warning.

### Version B

The way it happened caught us off guard. No one anticipated it, and even if they did, they kept quiet. In hindsight, a warning might have softened the blow, allowing us to brace ourselves. Instead, we carried on with our daily routines, oblivious to the impending change. When it struck, the shock was amplified by our ignorance, making the impact even more devastating than it might have been with some forewarning.

---

## Case 10: clarity-technical

**Type:** clarity | **Genre:** technical

**Instruction:** Improve clarity

### Original Text

> When you deploy your application to a serverless platform, the way cold starts interact with the connection pooling behavior of your database driver can create situations where, under certain traffic patterns, particularly those involving bursty request volumes following periods of inactivity, the number of database connections that get established can exceed what you would normally expect, and since each of these connections consumes memory and file descriptors on the database server, and because the serverless platform may be spinning up multiple instances of your function simultaneously to handle the burst, you can end up hitting your database's maximum connection limit, which results in connection refused errors that cascade through your application stack.

### Version A

When your application is deployed to a serverless platform, cold starts can affect the connection pooling behavior of your database driver. This can lead to scenarios where, under certain traffic patterns—especially bursty requests after inactivity—the number of database connections established may exceed expectations. Each connection uses memory and file descriptors on the database server. When multiple instances of your function spin up simultaneously to manage the burst, you may reach the database's connection limit, leading to connection refused errors that propagate through your application stack.

### Version B

When deploying your application to a serverless platform, cold starts can interact with your database driver's connection pooling in ways that lead to unexpected behavior. Specifically, bursty traffic patterns following periods of inactivity can cause the number of established database connections to spike. Each connection consumes memory and file descriptors on the database server. Additionally, the serverless platform may spin up multiple instances of your function concurrently to handle the burst, further exacerbating the issue. This can result in exceeding your database's maximum connection limit, leading to connection refused errors that propagate through your application stack.

---

## Latency

| Case | Edge (ms) | Frontier (ms) |
|------|-----------|---------------|
| simplify-memoir | 2360 | 3520 |
| simplify-technical | 2045 | 2417 |
| concision-memoir | 3087 | 2569 |
| concision-technical | 1952 | 1121 |
| expand-memoir | 4131 | 5967 |
| expand-technical | 3444 | 2273 |
| tone-shift-memoir | 3609 | 2954 |
| tone-shift-technical | 3063 | 1119 |
| clarity-memoir | 2170 | 3562 |
| clarity-technical | 2939 | 1702 |
| **Mean** | **2880** | **2720** |
| **P95** | **4131** | **5967** |

<details>
<summary>Reveal Key (click after evaluating)</summary>

| Case | Version A | Version B |
|------|-----------|-----------|
| simplify-memoir | Edge | Frontier |
| simplify-technical | Edge | Frontier |
| concision-memoir | Edge | Frontier |
| concision-technical | Edge | Frontier |
| expand-memoir | Frontier | Edge |
| expand-technical | Edge | Frontier |
| tone-shift-memoir | Edge | Frontier |
| tone-shift-technical | Edge | Frontier |
| clarity-memoir | Frontier | Edge |
| clarity-technical | Frontier | Edge |

</details>

## Verdict

**Result:** ___________________ (PASS / FAIL / CONDITIONAL)

**Notes:**

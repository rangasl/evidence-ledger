# Model code for "Nirvana as an exit condition" (Evidence Ledger research paper R01).
# Closed-form expected lives (Proposition 2), Monte Carlo check, seven-lives bound (Proposition 3).
# Run: python3 nirvana-model.py  (writes chart.json next to it)
import random, math, json
# States: 0 = nibbana (absorbing). 1..3 = noble stages (non-returner=1, once-returner=2, stream-enterer=3): no regression.
# 4..3+L = worldling craving levels: per life, down w.p. a, up w.p. b (reflect at top), else stay.
# Noble region: down w.p. a2 per life, never up.
def expected_worldling(L, a, b):
    # expected lives from top worldling level (3+L) to reach level 3
    rho = b/a
    T = [0]*(L+2)  # T[j] = expected time from level j to j-1, j=1..L (relative)
    T[L] = 1/a
    for j in range(L-1, 0, -1):
        T[j] = 1/a + rho*T[j+1]
    return sum(T[1:L+1])
def expected_total(L, a, b, a2):
    return expected_worldling(L, a, b) + 3/a2
def simulate(L, a, b, a2, runs=20000, cap=10**7, seed=1):
    rnd = random.Random(seed); out=[]
    for _ in range(runs):
        k, n = 3+L, 0
        while k > 0 and n < cap:
            n += 1; u = rnd.random()
            if k > 3:
                if u < a: k -= 1
                elif u < a+b and k < 3+L: k += 1
            else:
                if u < a2: k -= 1
        out.append(n)
    return sum(out)/len(out), sorted(out)
# 1. Monte Carlo check of closed form
for (L,a,b,a2) in [(3,0.2,0.1,0.8),(4,0.2,0.2,0.8),(4,0.2,0.3,0.8),(6,0.25,0.25,0.9)]:
    ex = expected_total(L,a,b,a2); mc,_ = simulate(L,a,b,a2,runs=20000)
    print(f"L={L} a={a} b={b} a2={a2}: formula {ex:.2f}  MC {mc:.2f}  diff {100*(mc-ex)/ex:+.1f}%")
# 2. Stream-entry bound: P(exit within 7 lives | stream-entry) for a2
def p_within(n, a2, steps=3):
    # negative binomial: need 3 successes within n trials
    return sum(math.comb(n, k)*a2**k*(1-a2)**(n-k) for k in range(steps, n+1))
for a2 in [0.4,0.5,0.6,0.7,0.8,0.9,0.95]:
    print(f"a2={a2}: P(exit within 7 lives)={p_within(7,a2):.3f}")
# find a2 for 0.99
lo,hi=0.0,1.0
for _ in range(60):
    m=(lo+hi)/2
    if p_within(7,m)>=0.99: hi=m
    else: lo=m
print("a2 needed for 99%:", round(hi,3))
# 3. Chart data: expected lives vs worldling levels L for rho in {0.5,1,2}, a=0.02, a2=0.8
rows=[]
for rho in [0.5,1,2]:
    for L in range(1,13):
        rows.append({"rho":rho,"L":L,"lives":round(expected_total(L,0.02,0.02*rho,0.8),1)})
json.dump(rows, open("chart.json","w"), indent=0)
for r in rows:
    if r["L"] in (1,4,8,12): print(r)
# 4. a=0 => never
print("a=0: exit impossible (state never decreases)")

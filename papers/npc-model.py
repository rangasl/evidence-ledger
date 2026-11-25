# Model code for "The NPC's problem" (Evidence Ledger research paper R02).
# Decisions needed to unmask an outside-steered agent (Propositions 1-2) and a Monte Carlo SPRT check.
import math, random
def kl(p,q):
    t=lambda a,b: 0 if a==0 else a*math.log(a/b)
    return t(p,q)+t(1-p,1-q)
def n_needed(lam,p0=0.5,f=0.5,post=99):
    p1=lam+(1-lam)*p0
    if lam<=0: return math.inf
    return math.log(post*(1-f)/f)/kl(p1,p0)
print("lam  f=1/2   f=1e-3   f=1e-9   approx 2p0 ln(99)/(lam^2(1-p0))")
for lam in [1,0.5,0.3,0.1,0.03,0.01,0.001]:
    print(f"{lam:<5}", *(f"{n_needed(lam,f=f):>9.1f}" for f in [0.5,1e-3,1e-9]), f"{2*0.5*math.log(99)/(lam**2*0.5):>10.1f}")
# Monte Carlo SPRT check: true lam, detective assumes lam
def sprt(lam, p0=0.5, f=0.5, post=99, runs=4000, seed=3):
    rnd=random.Random(seed); out=[]; target=math.log(post*(1-f)/f)
    p1=lam+(1-lam)*p0; up=math.log(p1/p0); dn=math.log(max(1e-12,1-p1)/(1-p0))
    for _ in range(runs):
        s=0;n=0
        while s<target and n<10**6:
            n+=1; s+= up if rnd.random()<p1 else dn
        out.append(n)
    return sum(out)/len(out)
for lam in [0.5,0.3,0.1]:
    print("MC lam",lam,"mean decisions",round(sprt(lam),1),"formula",round(n_needed(lam),1))

import {createEffect, createMemo, createSignal, onCleanup, onMount, untrack, type Accessor} from "solid-js";
import type {GameProfile} from "@finni/shared";
import {emptyHomeMemory, homeCandidates, homeMemoryKey, observeHome, readHomeMemory, type HomeEvent} from "./home-events";

/**
 * One current notice: `pending` keeps only observed reactions (transaction feedback),
 * while `queue` merges them with the profile conditions in the documented priority order.
 */
export function createHomeEventController(profile: Accessor<GameProfile | null>) {
  const [memory, setMemory] = createSignal(emptyHomeMemory());
  const [clock, setClock] = createSignal(Date.now());
  let key = "";
  onMount(() => {const timer = setInterval(() => setClock(Date.now()), 30000); onCleanup(() => clearInterval(timer));});
  const persist = (next: ReturnType<typeof emptyHomeMemory>) => {try {if(key) localStorage.setItem(key,JSON.stringify(next));} catch { /* optional presentation cache */ }};
  createEffect(() => {
    clock();
    const p=profile();
    if(!p) {key="";setMemory(emptyHomeMemory());return;}
    untrack(() => {
      const nextKey=homeMemoryKey(p);
      if(key!==nextKey) {key=nextKey;try {setMemory(readHomeMemory(localStorage.getItem(key)));}catch {setMemory(emptyHomeMemory());}}
      const before=memory();
      const observed=observeHome(p,before);
      // Only the persisted acknowledgement snapshot matters; avoid rewriting identical cache.
      if(JSON.stringify(observed)===JSON.stringify(before))return;
      setMemory(observed);persist(observed);
    });
  });
  const queue=createMemo((): HomeEvent[] => {
    clock();
    const p=profile();if(!p)return [];
    const m=memory();
    const conditions=homeCandidates(p,{...m,pending:[]});
    return [...m.pending,...conditions]
      .filter(e=>!m.seen.includes(e.id))
      .filter((e,i,all)=>all.findIndex(x=>x.id===e.id)===i)
      .sort((a,b)=>b.priority-a.priority);
  });
  return {queue,
    dismiss: (id:string) => {const m=memory();const next={...m,seen:[...new Set([...m.seen,id])]};setMemory(next);persist(next);},
    reset:()=>{const next=emptyHomeMemory();setMemory(next);persist(next);},
    forget:(mode?:"normal"|"demo")=>{const prefix=`finni.home-events.v1:${mode?`${mode}:`:""}`;if(key.startsWith(prefix))setMemory(emptyHomeMemory());try {for(const k of Object.keys(localStorage))if(k.startsWith(prefix))localStorage.removeItem(k);}catch{/* optional cache */}},
  };
}

"""Synthesised sound effects (generated numerically: no samples, no licensing, no music) + audio mixing."""
from __future__ import annotations
import subprocess, wave
import numpy as np

SR = 44100


def pop(): t = np.arange(int(.12*SR))/SR; return np.sin(2*np.pi*(520*np.exp(-t*18))*t) * np.exp(-t*28) * .5
def click(): t = np.arange(int(.05*SR))/SR; return (np.random.RandomState(1).randn(len(t)) * np.exp(-t*140)) * .35
def ding(): t = np.arange(int(.6*SR))/SR; return (np.sin(2*np.pi*1318*t) + .4*np.sin(2*np.pi*1975*t)) * np.exp(-t*7) * .25
def whoosh():
    n = int(.45*SR); r = np.random.RandomState(2).randn(n); t = np.arange(n)/SR; env = np.sin(np.pi*t/(n/SR))**2
    k = np.cumsum(r); k -= np.convolve(k, np.ones(400)/400, mode="same"); k = k / (np.abs(k).max() + 1e-9)
    return k * env * .35
def marker(): n = int(.35*SR); r = np.random.RandomState(3).randn(n); t = np.arange(n)/SR; return np.convolve(r, np.ones(30)/30, mode="same") * np.exp(-t*3) * .5 * np.minimum(1, t*80)
SFX = {"pop": pop, "click": click, "ding": ding, "whoosh": whoosh, "marker": marker}


def read_wav(path):
    """Any audio -> mono float32 @44.1k via ffmpeg."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True)
    if p.returncode: raise RuntimeError("ffmpeg could not decode " + str(path) + ": " + p.stderr.decode()[-200:])
    return np.frombuffer(p.stdout, np.int16).astype(np.float32) / 32768.0


def duration(path) -> float: return len(read_wav(path)) / SR


class Mixer:
    def __init__(self, seconds: float): self.buf = np.zeros(int((seconds + 1) * SR), np.float32)
    def add(self, sig, t, gain=1.0):
        i = int(max(t, 0) * SR); j = min(len(self.buf), i + len(sig))
        if j > i: self.buf[i:j] += sig[: j - i].astype(np.float32) * gain
    def add_sfx(self, name, t, gain=1.0): self.add(SFX[name](), t, gain)
    def save(self, path, seconds):
        b = np.clip(self.buf[: int(seconds * SR)], -1, 1); pk = np.abs(b).max()
        if pk > .98: b = b / pk * .98
        with wave.open(str(path), "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((b * 32767).astype(np.int16).tobytes())

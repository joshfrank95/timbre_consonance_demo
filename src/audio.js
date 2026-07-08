import { harmonicWeights, sum } from "./math.js";

function setGainImmediate(audioContext, gainNode, value) {
  const now = audioContext.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(value, now);
}

export class IntervalAudioEngine {
  constructor({ fundamentalHz, nPartials, masterGain = 0.3, timbres, getF0Ratio, getPlaybackMode }) {
    this.fundamentalHz = fundamentalHz;
    this.nPartials = nPartials;
    this.masterGain = masterGain;
    this.timbres = timbres;
    this.getF0Ratio = getF0Ratio;
    this.getPlaybackMode = getPlaybackMode;
    this.activeKey = timbres[0]?.key;
    this.audioContext = null;
    this.masterGainNode = null;
    this.banks = new Map();
  }

  get started() {
    return Boolean(this.audioContext);
  }

  start() {
    if (this.started) {
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      throw new Error("Web Audio is not supported in this browser.");
    }

    this.audioContext = new AudioContext();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.value = 1.0;
    this.masterGainNode.connect(this.audioContext.destination);

    this.timbres.forEach((timbre) => {
      const weights = harmonicWeights(timbre.partialRatios);
      const weightTotal = sum(weights);
      const bank = {
        timbre,
        weights,
        weightTotal,
        lowerOscillators: [],
        upperOscillators: [],
        lowerGainNodes: [],
        upperGainNodes: [],
      };

      for (let index = 0; index < this.nPartials; index += 1) {
        const lowerOscillator = this.audioContext.createOscillator();
        const lowerGainNode = this.audioContext.createGain();
        lowerOscillator.type = "sine";
        lowerOscillator.frequency.value = this.lowerFrequency(timbre, index);
        lowerGainNode.gain.value = 0;
        lowerOscillator.connect(lowerGainNode);
        lowerGainNode.connect(this.masterGainNode);
        lowerOscillator.start();
        bank.lowerOscillators.push(lowerOscillator);
        bank.lowerGainNodes.push(lowerGainNode);

        const upperOscillator = this.audioContext.createOscillator();
        const upperGainNode = this.audioContext.createGain();
        upperOscillator.type = "sine";
        upperOscillator.frequency.value = this.upperFrequency(timbre, index);
        upperGainNode.gain.value = 0;
        upperOscillator.connect(upperGainNode);
        upperGainNode.connect(this.masterGainNode);
        upperOscillator.start();
        bank.upperOscillators.push(upperOscillator);
        bank.upperGainNodes.push(upperGainNode);
      }

      this.banks.set(timbre.key, bank);
    });

    this.updatePlaybackGains();
  }

  setActiveKey(key) {
    this.activeKey = key;
    this.updatePlaybackGains();
  }

  updateUpperFrequencies(key) {
    if (!this.started) {
      return;
    }

    const bank = this.banks.get(key);
    if (!bank) {
      return;
    }

    for (let index = 0; index < this.nPartials; index += 1) {
      bank.upperOscillators[index].frequency.setTargetAtTime(
        this.upperFrequency(bank.timbre, index),
        this.audioContext.currentTime,
        0.01,
      );
    }
  }

  updatePlaybackGains() {
    if (!this.started) {
      return;
    }

    this.banks.forEach((bank, key) => {
      const isActive = key === this.activeKey;
      const mode = this.getPlaybackMode(key);

      for (let index = 0; index < this.nPartials; index += 1) {
        const gain = isActive ? this.partialGain(bank, index) : 0;
        let lowerGain = 0;
        let upperGain = 0;

        if (isActive) {
          if (mode === "lower") {
            lowerGain = gain;
          } else if (mode === "upper") {
            upperGain = gain;
          } else {
            lowerGain = gain;
            upperGain = gain;
          }
        }

        setGainImmediate(this.audioContext, bank.lowerGainNodes[index], lowerGain);
        setGainImmediate(this.audioContext, bank.upperGainNodes[index], upperGain);
      }
    });
  }

  stop() {
    this.banks.forEach((bank) => {
      bank.lowerOscillators.concat(bank.upperOscillators).forEach((oscillator) => {
        try {
          oscillator.stop();
        } catch (error) {
          // Oscillators can only be stopped once.
        }
      });
    });

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.masterGainNode = null;
    this.banks.clear();
  }

  partialGain(bank, index) {
    return this.masterGain * bank.weights[index] / bank.weightTotal;
  }

  lowerFrequency(timbre, index) {
    return this.fundamentalHz * timbre.partialRatios[index];
  }

  upperFrequency(timbre, index) {
    return this.fundamentalHz * this.getF0Ratio(timbre.key) * timbre.partialRatios[index];
  }
}

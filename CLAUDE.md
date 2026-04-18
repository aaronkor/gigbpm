# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permissions

You have full permissions for this project directory. Proceed without asking for confirmation on:
- Reading, writing, and deleting any files in this project
- All git commands (commit, push, branch, reset, etc.)
- Shell command execution within this directory

Do not pause to request permission for these operations.

## Project Overview

GigBPM is a mobile-first PWA for musicians to manage and run a live metronome across an entire performance set. Before a gig the musician builds named setlists — each song has a name and BPM. During performance the app runs a live audible (woodblock click) and visual (BPM ring halo) metronome; the musician advances to the next song via an on-screen button, headphone remote, or MIDI foot pedal.

Key characteristics:
- Svelte 5 + Vite + vite-plugin-pwa (fully offline, installable)
- **Metronome timing accuracy is the single most critical requirement** — Web Audio API lookahead scheduling only, never setInterval/setTimeout for clicks
- Dark theme optimised for stage use; three ring states (grey / white glow / red) communicate metronome state at a glance
- Multiple named setlists; songs stored as name + BPM; import/export as JSON
- Optional TTS song name announcement; optional MIDI CC bindings (Web MIDI API, not supported on iOS Safari)
- Fully offline, localStorage only — no backend, no sync

Full spec: `docs/superpowers/specs/2026-04-16-gigbpm-design.md`

## Commands

Always run 'npm push patch' before pushing to remote.

## Architecture

Update this section with high-level architecture notes once the project structure is established.

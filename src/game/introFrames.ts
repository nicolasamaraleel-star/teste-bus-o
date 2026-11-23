export interface IntroFrame {
  id: string;
  label: string;
  caption: string;
  imageSrc: string;
}

export const DEFAULT_INTRO_FRAMES: IntroFrame[] = [
  {
    id: 'sleep',
    label: '05:15 · QUADRO 1/4',
    caption: 'Zzz... (Acordando com sono no busão das 5h — SEU PONTO!)',
    imageSrc: '/src/assets/images/intro_sleep_dawn_1794915954943.jpg',
  },
  {
    id: 'rush',
    label: '05:30 · QUADRO 2/4',
    caption: 'EI! Dá licença aí no corredor!',
    imageSrc: '/src/assets/images/intro_rush_dawn_1794915955985.jpg',
  },
  {
    id: 'button',
    label: '05:45 · QUADRO 3/4',
    caption: 'PARADA SOLICITADA!!',
    imageSrc: '/src/assets/images/intro_button_dawn_1794915955964.jpg',
  },
  {
    id: 'ready',
    label: '05:55 · QUADRO 4/4',
    caption: 'Cara de sono, mas pronto! Lute por sua Saída!',
    imageSrc: '/src/assets/images/intro_ready_dawn_1794915957212.jpg',
  },
];

export const STOP_FRAME_BY_LINE: Record<string, string> = {
  '202': '/src/assets/images/stop_202_expresso_oz_1795314159239.jpg',
  '303': '/src/assets/images/stop_303_barro_fundo_1795314159563.jpg',
};

export const VICTORY_STORY_FRAMES: IntroFrame[] = [
  {
    id: 'elevator_pov',
    label: '08:56 · QUADRO 1/4',
    caption: '08:56 no elevador! Correndo pro 9º andar depois da briga no busão...',
    imageSrc: '/src/assets/images/victory_elevator_pov_1795363640404.jpg',
  },
  {
    id: 'elevator_mirror',
    label: '08:57 · QUADRO 2/4',
    caption: 'Espelho do elevador: rosto cheio de hematomas, mas a gravata tá firme!',
    imageSrc: '/src/assets/images/victory_elevator_mirror_1795363640496.jpg',
  },
  {
    id: 'clockin_pov',
    label: '08:59 · QUADRO 3/4',
    caption: '08:59! BATER PONTO AGORA!!',
    imageSrc: '/src/assets/images/victory_clockin_pov_1795363639872.jpg',
  },
  {
    id: 'bruised_finish',
    label: '08:59 · QUADRO 4/4',
    caption: 'PONTO BATIDO às 08:59! Todo quebrado, mas no horário!',
    imageSrc: '/src/assets/images/victory_bruised_finish_1795363640658.jpg',
  },
];

export const VICTORY_OFFICE_FRAME =
  '/src/assets/images/victory_bruised_finish_1795363640658.jpg';

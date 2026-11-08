import Phaser from 'phaser';

/**
 * Cena de inicialização: carrega assets e trata falhas de carregamento.
 * Por enquanto não há assets reais — apenas prepara a transição para a missão.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Placeholder de progresso (útil quando houver assets)
    const { width, height } = this.scale;

    const barWidth = 320;
    const barHeight = 16;
    const x = (width - barWidth) / 2;
    const y = height / 2;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 8);

    const progressBar = this.add.graphics();

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4caf50, 1);
      progressBar.fillRect(x, y, barWidth * value, barHeight);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.error('[BootScene] Falha ao carregar asset:', file.key, file.url);
      // Em produção poderíamos mostrar uma tela de erro amigável
    });

    // Nenhum asset real ainda. Quando existirem, carregue-os aqui.
    // Exemplo:
    // this.load.image('tile', 'assets/tiles/grass.png');
  }

  create(): void {
    this.scene.start('MissionScene');
  }
}

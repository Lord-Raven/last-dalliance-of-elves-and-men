import {CSSProperties, ReactElement} from 'react';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import {Unit} from './Unit';

export type CardTheme = {
    accent: string;
    accentSoft: string;
    attackLabel: string;
    flavor: string;
};

export const CARD_THEME: Record<Unit['type'], CardTheme> = {
    melee: {
        accent: '#34d399',
        accentSoft: 'rgba(52, 211, 153, 0.2)',
        attackLabel: 'Blade',
        flavor: 'A living bulwark of bark and steel.',
    },
    ranged: {
        accent: '#60a5fa',
        accentSoft: 'rgba(96, 165, 250, 0.2)',
        attackLabel: 'Arrow',
        flavor: 'Wind-guided volleys from the treeline.',
    },
    magic: {
        accent: '#c084fc',
        accentSoft: 'rgba(192, 132, 252, 0.2)',
        attackLabel: 'Arcana',
        flavor: 'Moonlit runes hum with ancient power.',
    },
};

const getAttackIcon = (type: Unit['type']): ReactElement => {
    if (type === 'melee') {
        return <GavelRoundedIcon style={{fontSize: 14}}/>;
    }

    if (type === 'ranged') {
        return <TrackChangesRoundedIcon style={{fontSize: 14}}/>;
    }

    return <AutoFixHighRoundedIcon style={{fontSize: 14}}/>;
};

export const UnitCardFace = ({card, theme}: {card: Unit; theme: CardTheme}): ReactElement => {
    const statCapsuleBase: CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
        minWidth: 40,
        borderRadius: 999,
        padding: '3px 7px',
        background: 'rgba(15, 23, 42, 0.92)',
        border: `1px solid ${theme.accent}`,
        boxShadow: '0 2px 8px rgba(2, 6, 23, 0.4)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
    };

    return <>
        <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${card.imageUrl})`,
            backgroundPosition: 'center 30%',
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            opacity: 0.16,
            filter: 'saturate(0.95)',
            pointerEvents: 'none',
        }}/>

        <div className={'unit-stat-capsule unit-cost-capsule'} style={{
            position: 'absolute',
            top: 12,
            left: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            background: 'rgba(15, 23, 42, 0.92)',
            border: `1px solid ${theme.accent}`,
            borderRadius: 999,
            padding: '3px 7px',
            boxShadow: '0 2px 8px rgba(2, 6, 23, 0.4)',
            color: '#fef9c3',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
            zIndex: 2,
        }}>
            <PaidRoundedIcon style={{fontSize: 13}}/>
            {card.cost}
        </div>

        <div style={{
            position: 'absolute',
            top: 12,
            right: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            zIndex: 2,
        }}>
            <div className={'unit-stat-capsule'} style={{
                ...statCapsuleBase,
                color: '#fde68a',
            }}>
                {getAttackIcon(card.type)}
                <span>{card.attack}</span>
            </div>
            <div className={'unit-stat-capsule'} style={{
                ...statCapsuleBase,
                color: '#fecaca',
            }}>
                <FavoriteRoundedIcon style={{fontSize: 14}}/>
                <span>{card.health}</span>
            </div>
            {card.shield > 0 ? <div className={'unit-stat-capsule'} style={{
                ...statCapsuleBase,
                color: '#bae6fd',
            }}>
                <ShieldRoundedIcon style={{fontSize: 14}}/>
                <span>{card.shield}</span>
            </div> : null}
        </div>

        <div style={{
            width: '90%',
            marginLeft: '5%',
            height: 186,
            borderRadius: 10,
            backgroundImage: `url(${card.portraitUrl})`,
            backgroundPosition: 'center 20%',
            backgroundSize: 'cover',
            border: `1px solid ${theme.accent}`,
            marginBottom: 10,
            position: 'relative',
            zIndex: 1,
        }}/>
        <div style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 6,
            fontFamily: 'Georgia, Times New Roman, serif',
            textShadow: '0 1px 8px rgba(15, 23, 42, 0.75)',
            position: 'relative',
            zIndex: 1,
        }}>
            {card.name}
        </div>

        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            fontSize: 11,
            fontWeight: 600,
            color: '#e2e8f0',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            position: 'relative',
            zIndex: 1,
        }}>
            <span style={{
                borderRadius: 999,
                border: `1px solid ${theme.accent}`,
                color: theme.accent,
                padding: '2px 6px',
                background: 'rgba(2, 6, 23, 0.5)',
            }}>
                {card.type}
            </span>
            <span>{theme.attackLabel}</span>
        </div>

        <div style={{
            marginTop: 'auto',
            borderTop: `1px solid ${theme.accentSoft}`,
            paddingTop: 8,
            minHeight: 38,
            fontSize: 11,
            color: '#cbd5e1',
            lineHeight: 1.35,
            fontStyle: 'italic',
            position: 'relative',
            zIndex: 1,
        }}>
            {card.flavor || theme.flavor}
        </div>
    </>;
};

import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Input from '../Form/Input';
import Select from '../Form/Select';
import Typeahead from '../Form/Typeahead';
import TextArea from '../Form/TextArea';
import ApiStatus from '../Site/ApiStatus';
import * as actions from '../../actions';

class DeckEditor extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            cardList: '',
            rookeryList: '',
            deckName: 'New Deck',
            faction: props.factions && props.factions['baratheon'],
            numberToAdd: 1,
            cards: [],
            showBanners: false,
            selectedBanner: {},
            validation: {
                deckname: '',
                cardToAdd: ''
            }
        };

        if(props.deck) {
            this.state.deckId = props.deck.id;
            this.state.deckName = props.deck.name;
            this.state.cards = props.deck.cards;
            this.state.faction = props.deck.faction;
            this.state.showBanners = this.isAllianceAgenda(this.getAgenda(props.deck.cards));
            this.state.status = props.deck.status;
            this.state.rookeryCards = props.deck.rookeryCards || [];

            let cardList = '';
            let rookeryList = '';

            for(const plot of props.deck.cards) {
                cardList += this.formatCardListItem(plot) + '\n';
            }

            this.state.cardList = cardList;

            for(const rookery of this.state.rookeryCards) {
                rookeryList += this.formatCardListItem(rookery) + '\n';
            }

            this.state.rookeryList = rookeryList;
        }
    }

    componentDidMount() {
        this.triggerDeckUpdated();
    }

    componentWillReceiveProps(props) {
        if(props.factions && !this.state.faction) {
            this.setState({ faction: props.factions['baratheon'] }, this.triggerDeckUpdated);
        }
    }

    getAgenda(cards) {
        let agenda = cards.find(c => c.card.type === 'agenda');

        return agenda && agenda.card;
    }

    getDeckFromState() {
        let deck = {
            id: this.state.deckId,
            name: this.state.deckName,
            faction: this.state.faction,
            agenda: this.state.agenda,
            cards: this.state.cards,
            rookeryCards: this.state.rookeryCards
        };

        deck.status = {};

        return deck;
    }

    triggerDeckUpdated() {
        const deck = this.getDeckFromState();

        if(this.props.onDeckUpdated) {
            this.props.onDeckUpdated(deck);
        }

        if(deck.faction) {
            this.props.validateDeck(deck);
        }
    }

    formatCardListItem(card) {
        if(!card.card) {
            return card.code;
        }

        if(card.card.custom) {
            let typeCode = card.card.type;
            let typeName = typeCode[0].toUpperCase() + typeCode.slice(1);
            return card.count + ' Custom ' + typeName + ' - ' + card.card.name;
        }

        return card.count + ' ' + card.card.label;
    }

    isAllianceAgenda(agenda) {
        return agenda && agenda.code === '06018';
    }

    onChange(field, event) {
        let state = this.state;

        state[field] = event.target.value;

        this.setState({ state }, this.triggerDeckUpdated);
    }

    onNumberToAddChange(event) {
        this.setState({ numberToAdd: event.target.value });
    }

    onFactionChange(selectedFaction) {
        this.setState({ faction: selectedFaction }, this.triggerDeckUpdated);
    }

    onAgendaChange(selectedAgenda) {
        let toUpdate = {
            showBanners: this.isAllianceAgenda(selectedAgenda)
        };

        let cards = this.state.cards.filter(c => c.card.type !== 'agenda');
        this.addCard(cards, selectedAgenda, 1);

        toUpdate.cards = cards;

        this.setState(toUpdate, this.triggerDeckUpdated);
    }

    onBannerChange(selectedBanner) {
        this.setState({ selectedBanner: selectedBanner });
    }

    onAddBanner(event) {
        event.preventDefault();

        if(!this.state.selectedBanner || !this.state.selectedBanner.code) {
            return;
        }

        let banners = this.state.cards.filter(c => c.card.traits.includes('Banner'));

        // Don't allow more than 2 banners
        if(banners.length >= 2) {
            return;
        }

        // Don't allow duplicate banners
        if(banners.some(banner => {
            return banner.code === this.state.selectedBanner.code;
        })) {
            return;
        }

        let cards = this.state.cards;

        this.addCard(cards, this.state.selectedBanner, 1);

        this.setState({ cards: cards }, this.triggerDeckUpdated);
    }

    onRemoveBanner(banner) {
        const cards = this.state.cards.filter(c => {
            return c.card.code !== banner.code;
        });

        this.setState({ cards: cards }, this.triggerDeckUpdated);
    }

    addCardChange(selectedCards) {
        this.setState({ cardToAdd: selectedCards[0] });
    }

    onAddCard(event) {
        event.preventDefault();

        if(!this.state.cardToAdd || !this.state.cardToAdd.label) {
            return;
        }

        let cardList = this.state.cardList;
        cardList += `${this.state.numberToAdd}  ${this.state.cardToAdd.label}\n`;

        let cards = this.state.cards;
        this.addCard(cards, this.state.cardToAdd, parseInt(this.state.numberToAdd));
        this.setState({ cardList: cardList, cards: cards }, this.triggerDeckUpdated);
    }

    onAddRookeryCard(event) {
        event.preventDefault();

        if(!this.state.cardToAdd || !this.state.cardToAdd.label) {
            return;
        }

        let rookeryList = this.state.rookeryList;
        rookeryList += `${this.state.numberToAdd}  ${this.state.cardToAdd.label}\n`;

        let cards = this.state.rookeryCards || [];
        this.addCard(cards, this.state.cardToAdd, parseInt(this.state.numberToAdd));
        this.setState({ rookeryList: rookeryList, rookeryCards: cards }, this.triggerDeckUpdated);
    }

    onRookeryListChange(event) {
        let split = event.target.value.split('\n');
        let rookeryCards = [];

        for(const line of split) {
            let trimmedLine = line.trim();
            let index = 2;

            let num = parseInt(trimmedLine[0]);
            if(isNaN(num)) {
                continue;
            }

            if(line[1] === 'x') {
                index++;
            }

            let card = this.lookupCard(trimmedLine, index);
            if(card) {
                this.addCard(rookeryCards, card, num);
            }
        }

        this.setState({ rookeryList: event.target.value, rookeryCards: rookeryCards }, this.triggerDeckUpdated);
    }

    onCardListChange(event) {
        let split = event.target.value.split('\n');
        let { deckName, faction, cards } = this.state;
        let agenda = this.getAgenda(this.state.cards);
        let banners = [];

        let headerMark = split.findIndex(line => line.match(/^Packs:/));
        if(headerMark >= 0) {
            // ThronesDB-style deck header found
            // extract deck title, faction, agenda, and banners
            let header = split.slice(0, headerMark).filter(line => line !== '');
            split = split.slice(headerMark);

            if(header.length >= 2) {
                deckName = header[0];

                let newFaction = Object.values(this.props.factions).find(faction => faction.name === header[1].trim());
                if(newFaction) {
                    faction = newFaction;
                }

                header = header.slice(2);
                if(header.length >= 1) {
                    let rawAgenda, rawBanners;

                    if(header.some(line => {
                        return line.trim() === 'Alliance';
                    })) {
                        rawAgenda = 'Alliance';
                        rawBanners = header.filter(line => line.trim() !== 'Alliance');
                    } else {
                        rawAgenda = header[0].trim();
                    }

                    let newAgenda = Object.values(this.props.agendas).find(agenda => agenda.name === rawAgenda);
                    if(newAgenda) {
                        agenda = newAgenda;
                    }

                    if(rawBanners) {
                        for(let rawBanner of rawBanners) {
                            let banner = this.props.banners.find(banner => {
                                return rawBanner.trim() === banner.label;
                            });

                            if(banner) {
                                banners.push(banner);
                            }
                        }
                    }
                }
            }
        }

        cards = [];

        for(const line of split) {
            let trimmedLine = line.trim();
            let index = 2;

            let num = parseInt(trimmedLine[0]);
            if(isNaN(num)) {
                continue;
            }

            if(line[1] === 'x') {
                index++;
            }

            let card = this.lookupCard(trimmedLine, index);
            if(card) {
                this.addCard(cards, card, num);
            }
        }

        if(agenda) {
            this.addCard(cards, agenda, 1);
        }

        for(let banner of banners) {
            this.addCard(cards, banner, 1);
        }

        this.setState({
            cardList: event.target.value,
            deckName: deckName,
            faction: faction,
            showBanners: this.isAllianceAgenda(agenda),
            cards: cards
        }, this.triggerDeckUpdated);
    }

    lookupCard(line, index) {
        let packOffset = line.indexOf('(');
        let cardName = line.substr(index, packOffset === -1 ? line.length : packOffset - index - 1).trim();
        let packName = line.substr(packOffset + 1, line.length - packOffset - 2);

        if(cardName.startsWith('Custom ')) {
            return this.createCustomCard(cardName);
        }

        let pack = this.props.packs.find(pack => {
            return pack.code.toLowerCase() === packName.toLowerCase() || pack.name.toLowerCase() === packName.toLowerCase();
        });

        return Object.values(this.props.cards).find(card => {
            if(this.props.agendas[card.code]) {
                return undefined;
            }

            if(pack) {
                return card.label.toLowerCase() === cardName.toLowerCase() || card.label.toLowerCase() === (cardName + ' (' + pack.code + ')').toLowerCase();
            }

            return card.label.toLowerCase() === cardName.toLowerCase();
        });
    }

    createCustomCard(cardName) {
        let match = /Custom (.*) - (.*)/.exec(cardName);
        if(!match) {
            return null;
        }

        let type = match[1].toLowerCase();
        let name = match[2];

        return {
            code: 'custom_' + type,
            cost: 0,
            custom: true,
            faction: 'neutral',
            icons: {
                military: true,
                intrigue: true,
                power: true
            },
            label: name + ' (Custom)',
            loyal: false,
            name: name,
            packCode: 'Custom',
            plotStats: {
                claim: 0,
                income: 0,
                initiative: 0,
                reserve: 0
            },
            strength: 0,
            text: 'Custom',
            traits: [],
            type: type,
            unique: name.includes('*')
        };
    }

    addCard(list, card, number) {
        if(list[card.code]) {
            list[card.code].count += number;
        } else {
            list.push({ count: number, card: card });
        }
    }

    onSaveClick(event) {
        event.preventDefault();

        if(this.props.onDeckSave) {
            this.props.onDeckSave(this.getDeckFromState());
        }
    }

    getBannerList() {
        let banners = this.state.cards.filter(c => c.card.traits.includes('Banner'));

        if(banners.length === 0) {
            return null;
        }

        return banners.map(c => {
            return (<div key={ c.card.code }>
                <span key={ c.card.code } className='card-link col-sm-10'>{ c.card.label }</span>
                <span className='glyphicon glyphicon-remove icon-danger btn col-sm-1' aria-hidden='true' onClick={ this.onRemoveBanner.bind(this, c.card) } />
            </div>);
        });
    }

    onCancelClick() {
        this.props.navigate('/decks');
    }

    render() {
        if(!this.props.factions || !this.props.agendas || !this.props.cards) {
            return <div>Please wait while loading from the server...</div>;
        }

        let banners = this.getBannerList();
        const cardsExcludingAgendas = Object.values(this.props.cards).filter(card => !this.props.agendas[card.code]);
        let agenda = this.getAgenda(this.state.cards);

        return (
            <div>
                <ApiStatus apiState={ this.props.apiState } successMessage={ this.props.deckSaved ? 'Deck saved successfully.' : null } />

                <div className='form-group'>
                    <div className='col-xs-12 deck-buttons'>
                        <span className='col-xs-2'>
                            <button ref='submit' type='submit' className='btn btn-primary' onClick={ this.onSaveClick.bind(this) }>Save { this.props.apiState && this.props.apiState.loading && <span className='spinner button-spinner' /> }</button>
                        </span>
                        <button ref='submit' type='button' className='btn btn-primary' onClick={ this.onCancelClick.bind(this) }>Cancel</button>
                    </div>
                </div>

                <h4>Either type the cards manually into the box below, add the cards one by one using the card box and autocomplete or for best results, copy and paste a decklist from <a href='http://thronesdb.com' target='_blank'>Thrones DB</a> into the box below.</h4>
                <form className='form form-horizontal'>
                    <Input name='deckName' label='Deck Name' labelClass='col-sm-3' fieldClass='col-sm-9' placeholder='Deck Name'
                        type='text' onChange={ this.onChange.bind(this, 'deckName') } value={ this.state.deckName } />
                    <Select name='faction' label='Faction' labelClass='col-sm-3' fieldClass='col-sm-9' options={ Object.values(this.props.factions) }
                        onChange={ this.onFactionChange.bind(this) } value={ this.state.faction ? this.state.faction.value : undefined } />
                    <Select name='agenda' label='Agenda' labelClass='col-sm-3' fieldClass='col-sm-9' options={ Object.values(this.props.agendas) }
                        onChange={ this.onAgendaChange.bind(this) } value={ agenda ? agenda.code : undefined }
                        valueKey='code' nameKey='label' blankOption={ { label: '- Select -', code: '' } } />

                    { this.state.showBanners &&
                        <div>
                            <Select name='banners' label='Banners' labelClass='col-sm-3' fieldClass='col-sm-9' options={ this.props.banners }
                                onChange={ this.onBannerChange.bind(this) } value={ this.state.selectedBanner ? this.state.selectedBanner.code : undefined }
                                valueKey='code' nameKey='label'
                                blankOption={ { label: '- Select -', code: '' } } button={ { text: 'Add', onClick: this.onAddBanner.bind(this) } } />
                            <div className='col-sm-9 col-sm-offset-3 banner-list'>
                                { banners }
                            </div>
                        </div>
                    }
                    <Typeahead label='Card' labelClass={ 'col-sm-3 col-xs-2' } fieldClass='col-sm-4 col-xs-5' labelKey={ 'label' } options={ cardsExcludingAgendas }
                        onChange={ this.addCardChange.bind(this) }>
                        <Input name='numcards' type='text' label='Num' labelClass='col-xs-1 no-x-padding' fieldClass='col-xs-2'
                            value={ this.state.numberToAdd.toString() } onChange={ this.onNumberToAddChange.bind(this) } noGroup>
                            <div className='col-xs-1 no-x-padding'>
                                <div className='btn-group'>
                                    <button className='btn btn-primary dropdown-toggle' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>
                                        Add <span className='caret' />
                                    </button>
                                    <ul className='dropdown-menu'>
                                        <li><a href='#' onClick={ this.onAddCard.bind(this) }>Add to deck</a></li>
                                        <li><a href='#' onClick={ this.onAddRookeryCard.bind(this) }>Add to rookery</a></li>
                                    </ul>
                                </div>
                            </div>
                        </Input>
                    </Typeahead>
                    <TextArea label='Cards' labelClass='col-sm-3' fieldClass='col-sm-9' rows='10' value={ this.state.cardList }
                        onChange={ this.onCardListChange.bind(this) } />
                    <TextArea label='Rookery' labelClass='col-sm-3' fieldClass='col-sm-9' rows='4' value={ this.state.rookeryList }
                        onChange={ this.onRookeryListChange.bind(this) } />

                    <div className='form-group'>
                        <div className='col-sm-offset-3 col-sm-8'>
                            <button ref='submit' type='submit' className='btn btn-primary' onClick={ this.onSaveClick.bind(this) }>Save { this.props.apiState && this.props.apiState.loading && <span className='spinner button-spinner' /> }</button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
}

DeckEditor.displayName = 'DeckEditor';
DeckEditor.propTypes = {
    agendas: PropTypes.object,
    apiState: PropTypes.object,
    banners: PropTypes.array,
    cards: PropTypes.object,
    deck: PropTypes.object,
    deckSaved: PropTypes.bool,
    factions: PropTypes.object,
    navigate: PropTypes.func,
    onDeckSave: PropTypes.func,
    onDeckUpdated: PropTypes.func,
    packs: PropTypes.array,
    updateDeck: PropTypes.func,
    validateDeck: PropTypes.func
};

function mapStateToProps(state) {
    return {
        agendas: state.cards.agendas,
        apiState: state.api.SAVE_DECK,
        banners: state.cards.banners,
        cards: state.cards.cards,
        deckSaved: state.cards.deckSaved,
        decks: state.cards.decks,
        factions: state.cards.factions,
        loading: state.api.loading,
        packs: state.cards.packs
    };
}

export default connect(mapStateToProps, actions)(DeckEditor);
